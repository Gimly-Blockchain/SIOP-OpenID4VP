import { Ed25519Signature2020 } from '@digitalcredentials/ed25519-signature-2020';
import { Ed25519VerificationKey2020 } from '@digitalcredentials/ed25519-verification-key-2020';
import * as vc from '@digitalcredentials/vc';
import {
  DomainLinkageCredential,
  IIssueCallbackArgs,
  IVerifyCallbackArgs,
  IVerifyCredentialResult,
  ProofFormatTypesEnum,
  WellKnownDidIssuer,
} from '@sphereon/wellknown-dids-client';
import nock from 'nock';

import { CheckLinkedDomain, validateLinkedDomainWithDid } from '../../src/main';
import * as didResolution from '../../src/main/did/DIDResolution';
import { DocumentLoader } from '../DocumentLoader';
import { DID_ION_DOCUMENT, DID_ION_ORIGIN, DID_KEY, DID_KEY_DOCUMENT, DID_KEY_ORIGIN, VC_KEY_PAIR } from '../data/mockedData';

jest.setTimeout(300000);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const verifyCallbackTruthy = async (_args: IVerifyCallbackArgs): Promise<IVerifyCredentialResult> => ({ verified: true });

let config;

const verify = async (args: IVerifyCallbackArgs): Promise<IVerifyCredentialResult> => {
  const keyPair = await Ed25519VerificationKey2020.from(VC_KEY_PAIR);
  const suite = new Ed25519Signature2020({ key: keyPair });
  suite.verificationMethod = keyPair.id;
  return await vc.verifyCredential({ credential: args.credential, suite, documentLoader: new DocumentLoader().getLoader() });
};

afterEach(() => {
  jest.clearAllMocks();
});

beforeAll(async () => {
  const issueCallback = async (args: IIssueCallbackArgs): Promise<DomainLinkageCredential> => {
    const keyPair = await Ed25519VerificationKey2020.from(VC_KEY_PAIR);
    const suite = new Ed25519Signature2020({ key: keyPair });
    suite.verificationMethod = keyPair.id;
    const documentLoader = new DocumentLoader();
    return await vc.issue({ credential: args.credential, suite, documentLoader: documentLoader.getLoader() });
  };

  const issuer: WellKnownDidIssuer = new WellKnownDidIssuer({
    issueCallback: (args: IIssueCallbackArgs) => issueCallback(args),
  });
  const args = {
    issuances: [
      {
        did: DID_KEY,
        origin: 'https://example.com',
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(new Date().getFullYear() + 10, new Date().getMonth(), new Date().getDay()).toISOString(),
        options: { proofFormat: ProofFormatTypesEnum.JSON_LD },
      },
    ],
  };
  config = await issuer.issueDidConfigurationResource(args);
});

describe('validateLinkedDomainWithDid', () => {
  it('should succeed with key did and CheckLinkedDomain.ALWAYS', async () => {
    const DID_CONFIGURATION = { ...config };
    nock(DID_KEY_ORIGIN).get('/.well-known/did-configuration.json').times(1).reply(200, DID_CONFIGURATION);
    // Needed to verify the credential
    nock(DID_KEY_ORIGIN).get('/1234').times(1).reply(200, DID_KEY_DOCUMENT);
    jest.spyOn(didResolution, 'resolveDidDocument').mockResolvedValue(Promise.resolve(DID_KEY_DOCUMENT as never));
    await expect(validateLinkedDomainWithDid(DID_KEY, (args: IVerifyCallbackArgs) => verify(args), CheckLinkedDomain.ALWAYS)).resolves.not.toThrow();
  });
  it('should succeed with ion did and CheckLinkedDomain.ALWAYS', async () => {
    const did =
      'did:ion:EiCMvVdXv6iL3W8i4n-LmqUhE614kX4TYxVR5kTY2QGOjg:eyJkZWx0YSI6eyJwYXRjaGVzIjpbeyJhY3Rpb24iOiJyZXBsYWNlIiwiZG9jdW1lbnQiOnsicHVibGljS2V5cyI6W3siaWQiOiJrZXkxIiwicHVibGljS2V5SndrIjp7ImNydiI6InNlY3AyNTZrMSIsImt0eSI6IkVDIiwieCI6Ii1MbHNpQVk5b3JmMXpKQlJOV0NuN0RpNUpoYl8tY2xhNlY5R3pHa3FmSFUiLCJ5IjoiRXBIU25GZHQ2ZU5lRkJEZzNVNVFIVDE0TVRsNHZIc0h5NWRpWU9DWEs1TSJ9LCJwdXJwb3NlcyI6WyJhdXRoZW50aWNhdGlvbiIsImFzc2VydGlvbk1ldGhvZCJdLCJ0eXBlIjoiRWNkc2FTZWNwMjU2azFWZXJpZmljYXRpb25LZXkyMDE5In1dLCJzZXJ2aWNlcyI6W3siaWQiOiJsZCIsInNlcnZpY2VFbmRwb2ludCI6Imh0dHBzOi8vbGR0ZXN0LnNwaGVyZW9uLmNvbSIsInR5cGUiOiJMaW5rZWREb21haW5zIn1dfX1dLCJ1cGRhdGVDb21taXRtZW50IjoiRWlBem8wTVVZUW5HNWM0VFJKZVFsNFR5WVRrSmRyeTJoeXlQUlpENzdFQm1CdyJ9LCJzdWZmaXhEYXRhIjp7ImRlbHRhSGFzaCI6IkVpQUwtaEtrLUVsODNsRVJiZkFDUk1kSWNQVjRXWGJqZ3dsZ1ZDWTNwbDhhMGciLCJyZWNvdmVyeUNvbW1pdG1lbnQiOiJFaUItT2NSbTlTNXdhU3QxbU4zSG4zM2RnMzJKN25MOEdBVHpGQ2ZXaWdIXzh3In19';
    const DID_CONFIGURATION = {
      '@context': 'https://identity.foundation/.well-known/did-configuration/v1',
      linked_dids: [
        'eyJhbGciOiJSUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa29USHNnTk5yYnk4SnpDTlExaVJMeVc1UVE2UjhYdXU2QUE4aWdHck1WUFVNI3o2TWtvVEhzZ05OcmJ5OEp6Q05RMWlSTHlXNVFRNlI4WHV1NkFBOGlnR3JNVlBVTSJ9.eyJleHAiOjE3NjQ4NzkxMzksImlzcyI6ImRpZDprZXk6ejZNa29USHNnTk5yYnk4SnpDTlExaVJMeVc1UVE2UjhYdXU2QUE4aWdHck1WUFVNIiwibmJmIjoxNjA3MTEyNzM5LCJzdWIiOiJkaWQ6a2V5Ono2TWtvVEhzZ05OcmJ5OEp6Q05RMWlSTHlXNVFRNlI4WHV1NkFBOGlnR3JNVlBVTSIsInZjIjp7IkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly9pZGVudGl0eS5mb3VuZGF0aW9uLy53ZWxsLWtub3duL2RpZC1jb25maWd1cmF0aW9uL3YxIl0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImlkIjoiZGlkOmtleTp6Nk1rb1RIc2dOTnJieThKekNOUTFpUkx5VzVRUTZSOFh1dTZBQThpZ0dyTVZQVU0iLCJvcmlnaW4iOiJodHRwczovL2lkZW50aXR5LmZvdW5kYXRpb24ifSwiZXhwaXJhdGlvbkRhdGUiOiIyMDI1LTEyLTA0VDE0OjEyOjE5LTA2OjAwIiwiaXNzdWFuY2VEYXRlIjoiMjAyMC0xMi0wNFQxNDoxMjoxOS0wNjowMCIsImlzc3VlciI6ImRpZDprZXk6ejZNa29USHNnTk5yYnk4SnpDTlExaVJMeVc1UVE2UjhYdXU2QUE4aWdHck1WUFVNIiwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIkRvbWFpbkxpbmthZ2VDcmVkZW50aWFsIl19fQ.YZnpPMAW3GdaPXC2YKoJ7Igt1OaVZKq09XZBkptyhxTAyHTkX2Ewtew-JKHKQjyDyabY3HAy1LUPoIQX0jrU0J82pIYT3k2o7nNTdLbxlgb49FcDn4czntt5SbY0m1XwrMaKEvV0bHQsYPxNTqjYsyySccgPfmvN9IT8gRS-M9a6MZQxuB3oEMrVOQ5Vco0bvTODXAdCTHibAk1FlvKz0r1vO5QMhtW4OlRrVTI7ibquf9Nim_ch0KeMMThFjsBDKetuDF71nUcL5sf7PCFErvl8ZVw3UK4NkZ6iM-XIRsLL6rXP2SnDUVovcldhxd_pyKEYviMHBOgBdoNP6fOgRQ',
        'eyJhbGciOiJSUzI1NiIsImtpZCI6ImRpZDprZXk6ejZNa29USHNnTk5yYnk4SnpDTlExaVJMeVc1UVE2UjhYdXU2QUE4aWdHck1WUFVNI3o2TWtvVEhzZ05OcmJ5OEp6Q05RMWlSTHlXNVFRNlI4WHV1NkFBOGlnR3JNVlBVTSJ9.eyJleHAiOjE3NjQ4NzkxMzksImlzcyI6ImRpZDprZXk6b3RoZXIiLCJuYmYiOjE2MDcxMTI3MzksInN1YiI6ImRpZDprZXk6b3RoZXIiLCJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vaWRlbnRpdHkuZm91bmRhdGlvbi8ud2VsbC1rbm93bi9kaWQtY29uZmlndXJhdGlvbi92MSJdLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDprZXk6b3RoZXIiLCJvcmlnaW4iOiJodHRwczovL2lkZW50aXR5LmZvdW5kYXRpb24ifSwiZXhwaXJhdGlvbkRhdGUiOiIyMDI1LTEyLTA0VDE0OjEyOjE5LTA2OjAwIiwiaXNzdWFuY2VEYXRlIjoiMjAyMC0xMi0wNFQxNDoxMjoxOS0wNjowMCIsImlzc3VlciI6ImRpZDprZXk6b3RoZXIiLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiRG9tYWluTGlua2FnZUNyZWRlbnRpYWwiXX19.rRuc-ojuEgyq8p_tBYK7BayuiNTBeXNyAnC14Rnjs-jsnhae4_E1Q12W99K2NGCGBi5KjNsBcZmdNJPxejiKPrjjcB99poFCgTY8tuRzDjVo0lIeBwfx9qqjKHTRTUR8FGM_imlOpVfBF4AHYxjkHvZn6c9lYvatYcDpB2UfH4BNXkdSVrUXy_kYjpMpAdRtyCAnD_isN1YpEHBqBmnfuVUbYcQK5kk6eiokRFDtWruL1OEeJMYPqjuBSd2m-H54tSM84Oic_pg2zXDjjBlXNelat6MPNT2QxmkwJg7oyewQWX2Ot2yyhSp9WyAQWMlQIe2x84R0lADUmZ1TPQchNw',
      ],
    };
    nock(DID_ION_ORIGIN).get('/.well-known/did-configuration.json').times(1).reply(200, DID_CONFIGURATION);
    jest.spyOn(didResolution, 'resolveDidDocument').mockResolvedValue(Promise.resolve(DID_ION_DOCUMENT as never));
    await expect(validateLinkedDomainWithDid(did, verifyCallbackTruthy, CheckLinkedDomain.ALWAYS)).resolves.not.toThrow();
  });

  it('should fail with ion did and CheckLinkedDomain.ALWAYS', async () => {
    const did =
      'did:ion:EiCMvVdXv6iL3W8i4n-LmqUhE614kX4TYxVR5kTY2QGOjg:eyJkZWx0YSI6eyJwYXRjaGVzIjpbeyJhY3Rpb24iOiJyZXBsYWNlIiwiZG9jdW1lbnQiOnsicHVibGljS2V5cyI6W3siaWQiOiJrZXkxIiwicHVibGljS2V5SndrIjp7ImNydiI6InNlY3AyNTZrMSIsImt0eSI6IkVDIiwieCI6Ii1MbHNpQVk5b3JmMXpKQlJOV0NuN0RpNUpoYl8tY2xhNlY5R3pHa3FmSFUiLCJ5IjoiRXBIU25GZHQ2ZU5lRkJEZzNVNVFIVDE0TVRsNHZIc0h5NWRpWU9DWEs1TSJ9LCJwdXJwb3NlcyI6WyJhdXRoZW50aWNhdGlvbiIsImFzc2VydGlvbk1ldGhvZCJdLCJ0eXBlIjoiRWNkc2FTZWNwMjU2azFWZXJpZmljYXRpb25LZXkyMDE5In1dLCJzZXJ2aWNlcyI6W3siaWQiOiJsZCIsInNlcnZpY2VFbmRwb2ludCI6Imh0dHBzOi8vbGR0ZXN0LnNwaGVyZW9uLmNvbSIsInR5cGUiOiJMaW5rZWREb21haW5zIn1dfX1dLCJ1cGRhdGVDb21taXRtZW50IjoiRWlBem8wTVVZUW5HNWM0VFJKZVFsNFR5WVRrSmRyeTJoeXlQUlpENzdFQm1CdyJ9LCJzdWZmaXhEYXRhIjp7ImRlbHRhSGFzaCI6IkVpQUwtaEtrLUVsODNsRVJiZkFDUk1kSWNQVjRXWGJqZ3dsZ1ZDWTNwbDhhMGciLCJyZWNvdmVyeUNvbW1pdG1lbnQiOiJFaUItT2NSbTlTNXdhU3QxbU4zSG4zM2RnMzJKN25MOEdBVHpGQ2ZXaWdIXzh3In19';
    await expect(validateLinkedDomainWithDid(did, verifyCallbackTruthy, CheckLinkedDomain.ALWAYS)).rejects.toThrow();
  });

  it('should fail with ion did and CheckLinkedDomain.IF_PRESENT', async () => {
    const did =
      'did:ion:EiCMvVdXv6iL3W8i4n-LmqUhE614kX4TYxVR5kTY2QGOjg:eyJkZWx0YSI6eyJwYXRjaGVzIjpbeyJhY3Rpb24iOiJyZXBsYWNlIiwiZG9jdW1lbnQiOnsicHVibGljS2V5cyI6W3siaWQiOiJrZXkxIiwicHVibGljS2V5SndrIjp7ImNydiI6InNlY3AyNTZrMSIsImt0eSI6IkVDIiwieCI6Ii1MbHNpQVk5b3JmMXpKQlJOV0NuN0RpNUpoYl8tY2xhNlY5R3pHa3FmSFUiLCJ5IjoiRXBIU25GZHQ2ZU5lRkJEZzNVNVFIVDE0TVRsNHZIc0h5NWRpWU9DWEs1TSJ9LCJwdXJwb3NlcyI6WyJhdXRoZW50aWNhdGlvbiIsImFzc2VydGlvbk1ldGhvZCJdLCJ0eXBlIjoiRWNkc2FTZWNwMjU2azFWZXJpZmljYXRpb25LZXkyMDE5In1dLCJzZXJ2aWNlcyI6W3siaWQiOiJsZCIsInNlcnZpY2VFbmRwb2ludCI6Imh0dHBzOi8vbGR0ZXN0LnNwaGVyZW9uLmNvbSIsInR5cGUiOiJMaW5rZWREb21haW5zIn1dfX1dLCJ1cGRhdGVDb21taXRtZW50IjoiRWlBem8wTVVZUW5HNWM0VFJKZVFsNFR5WVRrSmRyeTJoeXlQUlpENzdFQm1CdyJ9LCJzdWZmaXhEYXRhIjp7ImRlbHRhSGFzaCI6IkVpQUwtaEtrLUVsODNsRVJiZkFDUk1kSWNQVjRXWGJqZ3dsZ1ZDWTNwbDhhMGciLCJyZWNvdmVyeUNvbW1pdG1lbnQiOiJFaUItT2NSbTlTNXdhU3QxbU4zSG4zM2RnMzJKN25MOEdBVHpGQ2ZXaWdIXzh3In19';
    await expect(validateLinkedDomainWithDid(did, verifyCallbackTruthy, CheckLinkedDomain.IF_PRESENT)).rejects.toThrow();
  });
});
