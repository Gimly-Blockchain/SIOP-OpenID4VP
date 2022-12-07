import type { DIDResolutionResult, VerificationMethod } from 'did-resolver';

export interface EcdsaSignature {
  r: string;
  s: string;
  recoveryParam?: number | null;
}

// Signer interface conforming to the DID-JWT module
export type Signer = (data: string | Uint8Array) => Promise<EcdsaSignature | string>;

export interface JWTPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  iat?: number;
  nbf?: number;
  type?: string;
  exp?: number;
  rexp?: number;
  jti?: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [x: string]: any;
}

export interface VerifiedJWT {
  payload: Partial<JWTPayload>; // The JWT payload
  didResolutionResult: DIDResolutionResult; // DID resolution result including DID document
  issuer: string; //The issuer (did) of the JWT
  signer: VerificationMethod; // The matching verification method from the DID that was used to sign
  jwt: string; // The JWT
}

export declare type ECCurve = 'P-256' | 'secp256k1' | 'P-384' | 'P-521';
