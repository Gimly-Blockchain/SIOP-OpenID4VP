import Ajv from 'ajv';

import { AuthorizationRequestPayloadSchemaVD11, AuthorizationRequestPayloadSchemaVID1 } from '../schemas';
import { AuthorizationRequestPayload, SupportedVersion } from '../types';
import errors from '../types/Errors';

const ajv = new Ajv({ verbose: true, allowUnionTypes: true, strict: false, allErrors: true });
const validateD11 = ajv.compile(AuthorizationRequestPayloadSchemaVD11);
const validateID1 = ajv.compile(AuthorizationRequestPayloadSchemaVID1);
const validateJWTVCPresentationProfile = ajv.compile(AuthorizationRequestPayloadSchemaVID1);

export const authorizationRequestVersionDiscovery = (authorizationRequest: AuthorizationRequestPayload): SupportedVersion[] => {
  const versions = [];
  const authorizationRequestCopy: AuthorizationRequestPayload = JSON.parse(JSON.stringify(authorizationRequest));
  validateD11(authorizationRequestCopy) && versions.push(SupportedVersion.SIOPv2_D11);
  validateJWTVCPresentationProfile(authorizationRequestCopy) && versions.push(SupportedVersion.JWT_VC_PRESENTATION_PROFILE_v1);
  validateID1(authorizationRequestCopy) && versions.push(SupportedVersion.SIOPv2_ID1);
  if (versions.length === 0) {
    throw new Error(errors.SIOP_VERSION_NOT_SUPPORTED);
  }
  return versions;
};

export const checkSIOPSpecVersionSupported = async (
  payload: AuthorizationRequestPayload,
  supportedVersions: SupportedVersion[]
): Promise<SupportedVersion[]> => {
  const versions: SupportedVersion[] = authorizationRequestVersionDiscovery(payload);
  if (!supportedVersions || supportedVersions.length === 0) {
    return versions;
  }
  return supportedVersions.filter((version) => versions.includes(version));
};
