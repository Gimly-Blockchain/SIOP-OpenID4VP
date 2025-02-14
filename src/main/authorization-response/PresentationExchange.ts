import { EvaluationResults, IPresentationDefinition, KeyEncoding, PEX, PresentationSignOptions, SelectResults, Status } from '@sphereon/pex';
import { PresentationDefinitionV1, PresentationDefinitionV2, PresentationSubmission } from '@sphereon/pex-models';
import { IPresentation, IProofPurpose, IProofType, W3CVerifiableCredential, W3CVerifiablePresentation } from '@sphereon/ssi-types';

import { extractDataFromPath, getWithUrl } from '../helpers';
import { AuthorizationRequestPayload, SIOPErrors, SupportedVersion, VerifiablePresentationPayload } from '../types';

import {
  PresentationDefinitionLocation,
  PresentationDefinitionWithLocation,
  PresentationSignCallback,
  PresentationVerificationCallback,
} from './types';

export class PresentationExchange {
  readonly pex = new PEX();
  readonly allVerifiableCredentials: W3CVerifiableCredential[];
  readonly did;

  constructor(opts: { did: string; allVerifiableCredentials: W3CVerifiableCredential[] }) {
    this.did = opts.did;
    this.allVerifiableCredentials = opts.allVerifiableCredentials;
  }

  /**
   * Construct presentation submission from selected credentials
   * @param presentationDefinition: payload object received by the OP from the RP
   * @param selectedCredentials
   * @param options
   * @param presentationSignCallback
   */
  public async submissionFrom(
    presentationDefinition: IPresentationDefinition,
    selectedCredentials: W3CVerifiableCredential[],
    options?: { nonce?: string; domain?: string },
    presentationSignCallback?: PresentationSignCallback
  ): Promise<W3CVerifiablePresentation> {
    if (!presentationDefinition) {
      throw new Error(SIOPErrors.REQUEST_CLAIMS_PRESENTATION_DEFINITION_NOT_VALID);
    }

    const challenge: string = options?.nonce;
    const domain: string = options?.domain;

    // fixme: this needs to be configurable
    const signOptions: PresentationSignOptions = {
      proofOptions: {
        proofPurpose: IProofPurpose.authentication,
        type: IProofType.EcdsaSecp256k1Signature2019,
        challenge,
        domain,
      },
      signatureOptions: {
        verificationMethod: `${this.did}#key`,
        keyEncoding: KeyEncoding.Hex,
      },
    };

    return this.pex.verifiablePresentationFromAsync(presentationDefinition, selectedCredentials, presentationSignCallback, signOptions);
  }

  /**
   * This method will be called from the OP when we are certain that we have a
   * PresentationDefinition object inside our requestPayload
   * Finds a set of `VerifiableCredential`s from a list supplied to this class during construction,
   * matching presentationDefinition object found in the requestPayload
   * if requestPayload doesn't contain any valid presentationDefinition throws an error
   * if PEX library returns any error in the process, throws the error
   * returns the SelectResults object if successful
   * @param presentationDefinition: object received by the OP from the RP
   */
  public async selectVerifiableCredentialsForSubmission(presentationDefinition: IPresentationDefinition): Promise<SelectResults> {
    if (!presentationDefinition) {
      throw new Error(SIOPErrors.REQUEST_CLAIMS_PRESENTATION_DEFINITION_NOT_VALID);
    } else if (!this.allVerifiableCredentials || this.allVerifiableCredentials.length == 0) {
      throw new Error(`${SIOPErrors.COULD_NOT_FIND_VCS_MATCHING_PD}, no VCs were provided`);
    }
    const selectResults: SelectResults = this.pex.selectFrom(
      presentationDefinition,
      // fixme holder dids and limited disclosure
      this.allVerifiableCredentials,
      [this.did],
      []
    );
    if (selectResults.areRequiredCredentialsPresent == Status.ERROR) {
      throw new Error(`message: ${SIOPErrors.COULD_NOT_FIND_VCS_MATCHING_PD}, details: ${JSON.stringify(selectResults.errors)}`);
    }
    return selectResults;
  }

  /**
   * validatePresentationAgainstDefinition function is called mainly by the RP
   * after receiving the VP from the OP
   * @param presentationDefinition: object containing PD
   * @param verifiablePresentation:
   */
  public static async validatePresentationAgainstDefinition(
    presentationDefinition: IPresentationDefinition,
    verifiablePresentation: IPresentation
  ): Promise<EvaluationResults> {
    if (!presentationDefinition) {
      throw new Error(SIOPErrors.REQUEST_CLAIMS_PRESENTATION_DEFINITION_NOT_VALID);
    }
    const evaluationResults: EvaluationResults = new PEX().evaluatePresentation(presentationDefinition, verifiablePresentation);
    if (evaluationResults.errors.length) {
      throw new Error(`message: ${SIOPErrors.COULD_NOT_FIND_VCS_MATCHING_PD}, details: ${JSON.stringify(evaluationResults.errors)}`);
    }
    return evaluationResults;
  }

  public static assertValidPresentationSubmission(presentationSubmission: PresentationSubmission) {
    const validationResult = new PEX().validateSubmission(presentationSubmission);
    if (validationResult[0].message != 'ok') {
      throw new Error(`${SIOPErrors.RESPONSE_OPTS_PRESENTATIONS_SUBMISSION_IS_NOT_VALID}, details ${JSON.stringify(validationResult[0])}`);
    }
  }

  /**
   * Finds a valid PresentationDefinition inside the given AuthenticationRequestPayload
   * throws exception if the PresentationDefinition is not valid
   * returns null if no property named "presentation_definition" is found
   * returns a PresentationDefinition if a valid instance found
   * @param authorizationRequestPayload: object that can have a presentation_definition inside
   * @param version
   */
  public static async findValidPresentationDefinitions(
    authorizationRequestPayload: AuthorizationRequestPayload,
    version?: SupportedVersion
  ): Promise<PresentationDefinitionWithLocation[]> {
    const allDefinitions: PresentationDefinitionWithLocation[] = [];

    async function extractDefinitionFromVPToken() {
      const vpTokens: PresentationDefinitionV1[] | PresentationDefinitionV2[] = extractDataFromPath(
        authorizationRequestPayload,
        '$..vp_token.presentation_definition'
      );
      const vpTokenRefs = extractDataFromPath(authorizationRequestPayload, '$..vp_token.presentation_definition_uri');
      if (vpTokens && vpTokens.length && vpTokenRefs && vpTokenRefs.length) {
        throw new Error(SIOPErrors.REQUEST_CLAIMS_PRESENTATION_DEFINITION_BY_REF_AND_VALUE_NON_EXCLUSIVE);
      }
      if (vpTokens && vpTokens.length) {
        vpTokens.forEach((vpToken) => {
          PresentationExchange.assertValidPresentationDefinition(vpToken.value);
          allDefinitions.push({ definition: vpToken.value, location: PresentationDefinitionLocation.CLAIMS_VP_TOKEN, version });
        });
      } else if (vpTokenRefs && vpTokenRefs.length) {
        for (const vpTokenRef of vpTokenRefs) {
          const pd: PresentationDefinitionV1 | PresentationDefinitionV2 = (await getWithUrl(vpTokenRef.value)) as unknown as
            | PresentationDefinitionV1
            | PresentationDefinitionV2;
          PresentationExchange.assertValidPresentationDefinition(pd);
          allDefinitions.push({ definition: pd, location: PresentationDefinitionLocation.CLAIMS_VP_TOKEN, version });
        }
      }
    }

    function addSingleToplevelPDToPDs(definition: IPresentationDefinition, version?: SupportedVersion): void {
      PresentationExchange.assertValidPresentationDefinition(definition);
      allDefinitions.push({ definition: definition, location: PresentationDefinitionLocation.TOPLEVEL_PRESENTATION_DEF, version });
    }

    async function extractDefinitionFromTopLevelDefinitionProperty(version?: SupportedVersion) {
      const definitions = extractDataFromPath(authorizationRequestPayload, '$.presentation_definition');
      const definitionsFromList = extractDataFromPath(authorizationRequestPayload, '$.presentation_definition[*]');
      const definitionRefs = extractDataFromPath(authorizationRequestPayload, '$.presentation_definition_uri');
      const definitionRefsFromList = extractDataFromPath(authorizationRequestPayload, '$.presentation_definition_uri[*]');
      const hasPD = (definitions && definitions.length > 0) || (definitionsFromList && definitionsFromList > 0);
      const hasPdRef = (definitionRefs && definitionRefs.length > 0) || (definitionRefsFromList && definitionsFromList > 0);
      if (hasPD && hasPdRef) {
        throw new Error(SIOPErrors.REQUEST_CLAIMS_PRESENTATION_DEFINITION_BY_REF_AND_VALUE_NON_EXCLUSIVE);
      }
      if (definitions && definitions.length > 0) {
        definitions.forEach((definition) => {
          addSingleToplevelPDToPDs(definition.value, version);
        });
      } else if (definitionsFromList && definitionsFromList.length > 0) {
        definitionsFromList.forEach((definition) => {
          addSingleToplevelPDToPDs(definition.value, version);
        });
      } else if (definitionRefs && definitionRefs.length > 0) {
        for (const definitionRef of definitionRefs) {
          const pd: PresentationDefinitionV1 | PresentationDefinitionV2 = await getWithUrl(definitionRef.value);
          addSingleToplevelPDToPDs(pd, version);
        }
      } else if (definitionsFromList && definitionRefsFromList.length > 0) {
        for (const definitionRef of definitionRefsFromList) {
          const pd: PresentationDefinitionV1 | PresentationDefinitionV2 = await getWithUrl(definitionRef.value);
          addSingleToplevelPDToPDs(pd, version);
        }
      }
    }

    if (authorizationRequestPayload) {
      if (!version || version < SupportedVersion.SIOPv2_D11) {
        await extractDefinitionFromVPToken();
      }
      await extractDefinitionFromTopLevelDefinitionProperty();
    }
    return allDefinitions;
  }

  public static assertValidPresentationDefinitionWithLocations(definitionsWithLocations: PresentationDefinitionWithLocation[]) {
    if (definitionsWithLocations && definitionsWithLocations.length > 0) {
      definitionsWithLocations.forEach((definitionWithLocation) =>
        PresentationExchange.assertValidPresentationDefinition(definitionWithLocation.definition)
      );
    }
  }

  public static assertValidPresentationDefinitionWithLocation(defintionWithLocation: PresentationDefinitionWithLocation) {
    if (defintionWithLocation && defintionWithLocation.definition) {
      PresentationExchange.assertValidPresentationDefinition(defintionWithLocation.definition);
    }
  }

  private static assertValidPresentationDefinition(presentationDefinition: IPresentationDefinition) {
    const validationResult = new PEX().validateDefinition(presentationDefinition);
    if (validationResult[0].message != 'ok') {
      throw new Error(`${SIOPErrors.REQUEST_CLAIMS_PRESENTATION_DEFINITION_NOT_VALID}`);
    }
  }

  static async validatePayloadsAgainstDefinitions(
    definitions: PresentationDefinitionWithLocation[],
    vpPayloads: VerifiablePresentationPayload[],
    presentationSubmission?: PresentationSubmission,
    verifyPresentationCallback?: PresentationVerificationCallback
  ) {
    if (!definitions || !vpPayloads || !definitions.length || definitions.length !== vpPayloads.length) {
      throw new Error(SIOPErrors.COULD_NOT_FIND_VCS_MATCHING_PD);
    }
    await Promise.all(
      definitions.map(
        async (pd) =>
          await PresentationExchange.validatePayloadsAgainstDefinition(pd.definition, vpPayloads, presentationSubmission, verifyPresentationCallback)
      )
    );
  }

  private static async validatePayloadsAgainstDefinition(
    definition: IPresentationDefinition,
    vpPayloads: VerifiablePresentationPayload[],
    presentationSubmission: PresentationSubmission,
    verifyPresentationCallback?: PresentationVerificationCallback
  ) {
    const pex = new PEX();
    function filterValidPresentations() {
      //TODO: add support for multiple VPs here
      return vpPayloads.filter(async (vpw: VerifiablePresentationPayload) => {
        const presentation = vpw.presentation;
        // The verifyPresentationCallback function is mandatory for RP only,
        // So the behavior here is to bypass it if not present
        if (verifyPresentationCallback) {
          try {
            await verifyPresentationCallback({ ...vpw });
          } catch (error: unknown) {
            throw new Error(SIOPErrors.VERIFIABLE_PRESENTATION_SIGNATURE_NOT_VALID);
          }
        }
        // TODO: Limited disclosure suites
        const evaluationResults = presentationSubmission
          ? pex.evaluatePresentation(definition, { presentationSubmission, ...presentation }, [])
          : pex.evaluatePresentation(definition, { ...presentation }, []);
        const submission = evaluationResults.value;
        if (!presentation || !submission) {
          throw new Error(SIOPErrors.NO_PRESENTATION_SUBMISSION);
        }
        return submission && submission.definition_id === definition.id;
      });
    }

    const checkedPresentations: VerifiablePresentationPayload[] = filterValidPresentations();

    if (!checkedPresentations.length || checkedPresentations.length != 1) {
      throw new Error(`${SIOPErrors.COULD_NOT_FIND_VCS_MATCHING_PD}`);
    }
    const presentation: IPresentation = checkedPresentations[0].presentation;
    // TODO: Limited disclosure suites
    const evaluationResults = pex.evaluatePresentation(definition, presentation, []);
    PresentationExchange.assertValidPresentationSubmission(evaluationResults.value);
    await PresentationExchange.validatePresentationAgainstDefinition(definition, presentation);
  }
}
