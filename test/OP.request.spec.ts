import { IProofType } from '@sphereon/ssi-types';
import { IVerifyCallbackArgs, IVerifyCredentialResult } from '@sphereon/wellknown-dids-client';
import nock from 'nock';

import {
  AuthorizationResponseOpts,
  Builder,
  CheckLinkedDomain,
  CreateAuthorizationRequestOpts,
  OP,
  PassBy,
  ResponseIss,
  ResponseMode,
  ResponseType,
  RP,
  Scope,
  SigningAlgo,
  SubjectIdentifierType,
  SubjectType,
  SupportedVersion,
  VerificationMode,
  VerifyAuthorizationRequestOpts,
} from '../src/main';

import { mockedGetEnterpriseAuthToken, WELL_KNOWN_OPENID_FEDERATION } from './TestUtils';
import {
  UNIT_TEST_TIMEOUT,
  VERIFIER_LOGO_FOR_CLIENT,
  VERIFIER_NAME_FOR_CLIENT,
  VERIFIER_NAME_FOR_CLIENT_NL,
  VERIFIERZ_PURPOSE_TO_VERIFY,
  VERIFIERZ_PURPOSE_TO_VERIFY_NL,
} from './data/mockedData';

const EXAMPLE_REDIRECT_URL = 'https://acme.com/hello';
const EXAMPLE_REFERENCE_URL = 'https://rp.acme.com/siop/jwts';

const HEX_KEY = 'f857544a9d1097e242ff0b287a7e6e90f19cf973efe2317f2a4678739664420f';
const DID = 'did:ethr:0x0106a2e985b1E1De9B5ddb4aF6dC9e928F4e99D0';
const KID = 'did:ethr:0x0106a2e985b1E1De9B5ddb4aF6dC9e928F4e99D0#controller';

describe('OP Builder should', () => {
  it('throw Error when no arguments are passed', async () => {
    expect.assertions(1);
    await expect(() => new Builder().build()).toThrowError(Error);
  });
  it('build an OP when all arguments are set', async () => {
    expect.assertions(1);

    expect(
      OP.builder()
        .withCheckLinkedDomain(CheckLinkedDomain.NEVER)
        .addDidMethod('ethr')
        .addIssuer(ResponseIss.SELF_ISSUED_V2)
        .response(ResponseMode.POST)
        .registrationBy({
          registrationBy: { passBy: PassBy.REFERENCE, referenceUri: 'https://registration.here' },
          logoUri: VERIFIER_LOGO_FOR_CLIENT,
          clientName: VERIFIER_NAME_FOR_CLIENT,
          'clientName#nl-NL': VERIFIER_NAME_FOR_CLIENT_NL + '2022100332',
          clientPurpose: VERIFIERZ_PURPOSE_TO_VERIFY,
          'clientPurpose#nl-NL': VERIFIERZ_PURPOSE_TO_VERIFY_NL,
        })
        .internalSignature('myprivatekey', 'did:example:123', 'did:example:123#key', SigningAlgo.ES256K)
        .withExpiresIn(1000)
        .withSupportedVersions([SupportedVersion.SIOPv2_ID1])
        .build()
    ).toBeInstanceOf(OP);
  });
});

describe('OP should', () => {
  const responseOpts: AuthorizationResponseOpts = {
    checkLinkedDomain: CheckLinkedDomain.NEVER,
    redirectUri: EXAMPLE_REDIRECT_URL,
    signatureType: {
      hexPrivateKey: HEX_KEY,
      did: DID,
      kid: KID,
      alg: SigningAlgo.ES256K,
    },
    registration: {
      authorizationEndpoint: 'www.myauthorizationendpoint.com',
      responseTypesSupported: [ResponseType.ID_TOKEN],
      subjectSyntaxTypesSupported: ['did:web'],
      vpFormats: {
        ldp_vc: {
          proof_type: [IProofType.EcdsaSecp256k1Signature2019, IProofType.EcdsaSecp256k1Signature2019],
        },
      },
      logoUri: VERIFIER_LOGO_FOR_CLIENT,
      clientName: VERIFIER_NAME_FOR_CLIENT,
      'clientName#nl-NL': VERIFIER_NAME_FOR_CLIENT_NL + '2022100333',
      clientPurpose: VERIFIERZ_PURPOSE_TO_VERIFY,
      'clientPurpose#nl-NL': VERIFIERZ_PURPOSE_TO_VERIFY_NL,
      //TODO: fill it up with actual value
      issuer: ResponseIss.SELF_ISSUED_V2,
      registrationBy: {
        passBy: PassBy.VALUE,
      },
    },
    responseMode: ResponseMode.POST,
    did: DID,
    expiresIn: 2000,
  };

  const verifyOpts: VerifyAuthorizationRequestOpts = {
    verification: {
      mode: VerificationMode.INTERNAL,
      resolveOpts: {
        subjectSyntaxTypesSupported: ['did:ethr'],
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      wellknownDIDVerifyCallback: async (_args: IVerifyCallbackArgs): Promise<IVerifyCredentialResult> => ({ verified: true }),
    },
    supportedVersions: [SupportedVersion.SIOPv2_ID1],
    nonce: 'qBrR7mqnY3Qr49dAZycPF8FzgE83m6H0c2l0bzP4xSg',
  };

  it('throw Error when build from request opts without enough params', async () => {
    expect.assertions(1);
    await expect(() => OP.fromOpts({} as never, {} as never)).toThrowError(Error);
  });

  it('return an OP when all request arguments are set', async () => {
    expect.assertions(1);

    expect(OP.fromOpts(responseOpts, verifyOpts)).toBeInstanceOf(OP);
  });

  it(
    'succeed from request opts when all params are set',
    async () => {
      const mockEntity = await mockedGetEnterpriseAuthToken('ACME Corp');
      const requestOpts: CreateAuthorizationRequestOpts = {
        version: SupportedVersion.SIOPv2_ID1,
        payload: {
          redirect_uri: EXAMPLE_REDIRECT_URL,
          client_id: WELL_KNOWN_OPENID_FEDERATION,
          scope: 'test',
          response_type: 'id_token',
        },

        requestObject: {
          passBy: PassBy.REFERENCE,
          referenceUri: EXAMPLE_REFERENCE_URL,

          signatureType: {
            hexPrivateKey: mockEntity.hexPrivateKey,
            did: mockEntity.did,
            kid: `${mockEntity.did}#controller`,
            alg: SigningAlgo.ES256K,
          },
        },
        clientMetadata: {
          clientId: WELL_KNOWN_OPENID_FEDERATION,
          idTokenSigningAlgValuesSupported: [SigningAlgo.EDDSA, SigningAlgo.ES256],
          subjectSyntaxTypesSupported: ['did:ethr', SubjectIdentifierType.DID],
          requestObjectSigningAlgValuesSupported: [SigningAlgo.EDDSA, SigningAlgo.ES256],
          responseTypesSupported: [ResponseType.ID_TOKEN],
          scopesSupported: [Scope.OPENID_DIDAUTHN, Scope.OPENID],
          subjectTypesSupported: [SubjectType.PAIRWISE],
          vpFormatsSupported: {
            jwt_vc: { alg: [SigningAlgo.EDDSA, SigningAlgo.ES256K, SigningAlgo.ES256] },
            jwt_vp: { alg: [SigningAlgo.EDDSA, SigningAlgo.ES256K, SigningAlgo.ES256] },
            jwt: { alg: [SigningAlgo.EDDSA, SigningAlgo.ES256K, SigningAlgo.ES256] },
          },
          passBy: PassBy.VALUE,
          logoUri: VERIFIER_LOGO_FOR_CLIENT,
          clientName: VERIFIER_NAME_FOR_CLIENT,
          'clientName#nl-NL': VERIFIER_NAME_FOR_CLIENT_NL + '2022100334',
          clientPurpose: VERIFIERZ_PURPOSE_TO_VERIFY,
          'clientPurpose#nl-NL': VERIFIERZ_PURPOSE_TO_VERIFY_NL,
        },
      };

      const requestURI = await RP.fromRequestOpts(requestOpts).createAuthorizationRequestURI({
        nonce: 'qBrR7mqnY3Qr49dAZycPF8FzgE83m6H0c2l0bzP4xSg',
        state: 'b32f0087fc9816eb813fd11f',
      });

      nock('https://rp.acme.com').get('/siop/jwts').reply(200, requestURI.requestObjectJwt);

      const verifiedRequest = await OP.fromOpts(responseOpts, verifyOpts).verifyAuthorizationRequest(requestURI.encodedUri);
      console.log(JSON.stringify(verifiedRequest));
      expect(verifiedRequest.issuer).toMatch(mockEntity.did);
      expect(verifiedRequest.signer).toMatchObject({
        id: `${mockEntity.did}#controller`,
        type: 'EcdsaSecp256k1RecoveryMethod2020',
        controller: `${mockEntity.did}`,
      });
      expect(verifiedRequest.jwt).toBeDefined();
    },
    UNIT_TEST_TIMEOUT
  );

  it('succeed from builder when all params are set', async () => {
    const rpMockEntity = await mockedGetEnterpriseAuthToken('ACME RP');
    const opMockEntity = await mockedGetEnterpriseAuthToken('ACME OP');

    const requestURI = await RP.builder({ requestVersion: SupportedVersion.SIOPv2_ID1 })
      .withClientId(WELL_KNOWN_OPENID_FEDERATION)
      .withScope('test')
      .withResponseType(ResponseType.ID_TOKEN)
      .withCheckLinkedDomain(CheckLinkedDomain.NEVER)
      .withAuthorizationEndpoint('www.myauthorizationendpoint.com')
      .withRedirectUri(EXAMPLE_REFERENCE_URL)
      .withRequestBy(PassBy.VALUE)
      .withInternalSignature(rpMockEntity.hexPrivateKey, rpMockEntity.did, `${rpMockEntity.did}#controller`, SigningAlgo.ES256K)
      .addDidMethod('ethr')
      .withClientMetadata({
        clientId: WELL_KNOWN_OPENID_FEDERATION,
        idTokenSigningAlgValuesSupported: [SigningAlgo.EDDSA],
        requestObjectSigningAlgValuesSupported: [SigningAlgo.EDDSA, SigningAlgo.ES256],
        responseTypesSupported: [ResponseType.ID_TOKEN],
        vpFormatsSupported: { jwt_vc: { alg: [SigningAlgo.EDDSA] } },
        scopesSupported: [Scope.OPENID_DIDAUTHN, Scope.OPENID],
        subjectTypesSupported: [SubjectType.PAIRWISE],
        subjectSyntaxTypesSupported: ['did', 'did:ethr'],
        passBy: PassBy.VALUE,
        logoUri: VERIFIER_LOGO_FOR_CLIENT,
        clientName: VERIFIER_NAME_FOR_CLIENT,
        'clientName#nl-NL': VERIFIER_NAME_FOR_CLIENT_NL + '2022100335',
        clientPurpose: VERIFIERZ_PURPOSE_TO_VERIFY,
        'clientPurpose#nl-NL': VERIFIERZ_PURPOSE_TO_VERIFY_NL,
      })
      .build()

      .createAuthorizationRequestURI({
        nonce: 'qBrR7mqnY3Qr49dAZycPF8FzgE83m6H0c2l0bzP4xSg',
        state: 'b32f0087fc9816eb813fd11f',
      });

    const verifiedRequest = await OP.builder()
      .withCheckLinkedDomain(CheckLinkedDomain.NEVER)
      .withExpiresIn(1000)
      .addIssuer(ResponseIss.SELF_ISSUED_V2)
      .addDidMethod('ethr')
      .internalSignature(opMockEntity.hexPrivateKey, opMockEntity.did, `${opMockEntity.did}#controller`, SigningAlgo.ES256K)
      .registrationBy({
        idTokenSigningAlgValuesSupported: [SigningAlgo.EDDSA],
        requestObjectSigningAlgValuesSupported: [SigningAlgo.EDDSA, SigningAlgo.ES256],
        responseTypesSupported: [ResponseType.ID_TOKEN],
        vpFormats: { ldp_vc: { proof_type: [IProofType.EcdsaSecp256k1Signature2019, IProofType.EcdsaSecp256k1Signature2019] } },
        scopesSupported: [Scope.OPENID_DIDAUTHN, Scope.OPENID],
        subjectTypesSupported: [SubjectType.PAIRWISE],
        subjectSyntaxTypesSupported: ['did', 'did:ethr'],
        registrationBy: { passBy: PassBy.VALUE },
        logoUri: VERIFIER_LOGO_FOR_CLIENT,
        clientName: VERIFIER_NAME_FOR_CLIENT,
        'clientName#nl-NL': VERIFIER_NAME_FOR_CLIENT_NL + '2022100336',
        clientPurpose: VERIFIERZ_PURPOSE_TO_VERIFY,
        'clientPurpose#nl-NL': VERIFIERZ_PURPOSE_TO_VERIFY_NL,
      })
      .withSupportedVersions([SupportedVersion.SIOPv2_ID1])
      .build()

      .verifyAuthorizationRequest(requestURI.encodedUri);
    console.log(JSON.stringify(verifiedRequest));
    expect(verifiedRequest.issuer).toMatch(rpMockEntity.did);
    expect(verifiedRequest.signer).toMatchObject({
      id: `${rpMockEntity.did}#controller`,
      type: 'EcdsaSecp256k1RecoveryMethod2020',
      controller: `${rpMockEntity.did}`,
    });
    expect(verifiedRequest.jwt).toBeDefined();
  });
});
