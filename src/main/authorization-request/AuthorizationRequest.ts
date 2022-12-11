import { PresentationExchange } from '../authorization-response/PresentationExchange';
import { getAudience, getResolver, parseJWT, verifyDidJWT } from '../did';
import { fetchByReferenceOrUseByValue } from '../helpers';
import { checkSIOPSpecVersionSupported } from '../helpers/SIOPSpecVersion';
import { RequestObject } from '../request-object';
import {
  AuthorizationRequestPayload,
  PassBy,
  RequestObjectJwt,
  RequestObjectPayload,
  RequestStateInfo,
  RPRegistrationMetadataPayload,
  SIOPErrors,
  VerifiedAuthorizationRequest,
  VerifiedJWT,
} from '../types';

import { assertValidAuthorizationRequestOpts, assertValidVerifyAuthorizationRequestOpts } from './Opts';
import { assertValidRPRegistrationMedataPayload, checkWellknownDIDFromRequest, createAuthorizationRequestPayload } from './Payload';
import { URI } from './URI';
import { CreateAuthorizationRequestOpts, VerifyAuthorizationRequestOpts } from './types';

export class AuthorizationRequest {
  private readonly _requestObject: RequestObject;
  private readonly _payload: AuthorizationRequestPayload;
  private readonly _options: CreateAuthorizationRequestOpts;
  private _uri: URI;

  private constructor(payload: AuthorizationRequestPayload, requestObject?: RequestObject, opts?: CreateAuthorizationRequestOpts, uri?: URI) {
    this._options = opts;
    this._payload = payload;
    this._requestObject = requestObject;
    this._uri = uri;
  }

  public static async fromUriOrJwt(jwtOrUri: string | URI): Promise<AuthorizationRequest> {
    if (!jwtOrUri) {
      throw Error(SIOPErrors.BAD_PARAMS);
    }
    return typeof jwtOrUri === 'string' && jwtOrUri.startsWith('ey')
      ? await AuthorizationRequest.fromJwt(jwtOrUri)
      : await AuthorizationRequest.fromURI(jwtOrUri);
  }

  public static async fromPayload(payload: AuthorizationRequestPayload): Promise<AuthorizationRequest> {
    if (!payload) {
      throw Error(SIOPErrors.BAD_PARAMS);
    }
    const requestObject = await RequestObject.fromAuthorizationRequestPayload(payload);
    return new AuthorizationRequest(payload, requestObject);
  }

  public static async fromOpts(opts: CreateAuthorizationRequestOpts, requestObject?: RequestObject): Promise<AuthorizationRequest> {
    if (!opts || !opts.requestObject) {
      throw Error(SIOPErrors.BAD_PARAMS);
    }
    assertValidAuthorizationRequestOpts(opts);
    const requestObjectArg =
      opts.requestObject.passBy !== PassBy.NONE ? (requestObject ? requestObject : await RequestObject.fromOpts(opts)) : undefined;
    const requestPayload = await createAuthorizationRequestPayload(opts, requestObjectArg);
    return new AuthorizationRequest(requestPayload, requestObjectArg, opts);
  }

  get payload(): AuthorizationRequestPayload {
    return this._payload;
  }

  get requestObject(): RequestObject | undefined {
    return this._requestObject;
  }

  get options(): CreateAuthorizationRequestOpts | undefined {
    return this._options;
  }

  public hasRequestObject(): boolean {
    return this.requestObject !== undefined;
  }

  async uri(): Promise<URI> {
    if (!this._uri) {
      this._uri = await URI.fromAuthorizationRequest(this);
    }
    return this._uri;
  }

  /**
   * Verifies a SIOP Request JWT on OP side
   *
   * @param uriOrJwt
   * @param opts
   */
  async verify(opts: VerifyAuthorizationRequestOpts): Promise<VerifiedAuthorizationRequest> {
    assertValidVerifyAuthorizationRequestOpts(opts);

    let requestObjectPayload: RequestObjectPayload;
    let verifiedJwt: VerifiedJWT;

    const jwt = await this.requestObjectJwt();
    if (jwt) {
      parseJWT(jwt);
      const options = {
        audience: getAudience(jwt),
      };

      verifiedJwt = await verifyDidJWT(jwt, getResolver(opts.verification.resolveOpts), options);
      if (!verifiedJwt || !verifiedJwt.payload) {
        throw Error(SIOPErrors.ERROR_VERIFYING_SIGNATURE);
      }
      requestObjectPayload = verifiedJwt.payload as RequestObjectPayload;

      if (this.hasRequestObject() && !this.payload.request_uri) {
        // Put back the request object as that won't be present yet
        this.payload.request = jwt;
      }
    }

    // AuthorizationRequest.assertValidRequestObject(origAuthenticationRequest);

    // We use the orig request for default values, but the JWT payload contains signed request object properties
    const authorizationRequestPayload = { ...this.payload, ...requestObjectPayload };
    const versions = await checkSIOPSpecVersionSupported(authorizationRequestPayload, opts.supportedVersions);
    if (opts.nonce && authorizationRequestPayload.nonce !== opts.nonce) {
      throw new Error(`${SIOPErrors.BAD_NONCE} payload: ${authorizationRequestPayload.nonce}, supplied: ${opts.nonce}`);
    }

    // todo: We can use client_metadata here as well probably
    const registrationMetadata: RPRegistrationMetadataPayload = await fetchByReferenceOrUseByValue(
      authorizationRequestPayload['registration_uri'],
      authorizationRequestPayload['registration']
    );
    assertValidRPRegistrationMedataPayload(registrationMetadata);
    await checkWellknownDIDFromRequest(authorizationRequestPayload, opts);
    const presentationDefinitions = await PresentationExchange.findValidPresentationDefinitions(authorizationRequestPayload);
    return {
      ...verifiedJwt,
      authorizationRequest: this,
      verifyOpts: opts,
      presentationDefinitions,
      requestObject: this.requestObject,
      authorizationRequestPayload: authorizationRequestPayload,
      versions,
    };
  }

  static async verify(requestOrUri: string, verifyOpts: VerifyAuthorizationRequestOpts) {
    assertValidVerifyAuthorizationRequestOpts(verifyOpts);
    const authorizationRequest = await AuthorizationRequest.fromUriOrJwt(requestOrUri);
    return await authorizationRequest.verify(verifyOpts);
  }

  public async requestObjectJwt(): Promise<RequestObjectJwt | undefined> {
    return await this.requestObject?.toJwt();
  }

  private static async fromJwt(jwt: string): Promise<AuthorizationRequest> {
    if (!jwt) {
      throw Error(SIOPErrors.BAD_PARAMS);
    }
    const requestObject = await RequestObject.fromJwt(jwt);
    const payload: AuthorizationRequestPayload = { ...(await requestObject.getPayload()) } as AuthorizationRequestPayload;
    // Although this was a RequestObject we instantiate it as AuthzRequest and then copy in the JWT as the request Object
    payload.request = jwt;
    return new AuthorizationRequest({ ...payload }, requestObject);
  }

  private static async fromURI(uri: URI | string): Promise<AuthorizationRequest> {
    if (!uri) {
      throw Error(SIOPErrors.BAD_PARAMS);
    }
    const uriObject = typeof uri === 'string' ? await URI.fromUri(uri) : uri;
    const requestObject = await RequestObject.fromJwt(uriObject.requestObjectJwt);
    return new AuthorizationRequest(uriObject.authorizationRequestPayload, requestObject, undefined, uriObject);
  }

  public async toStateInfo(): Promise<RequestStateInfo> {
    const requestObject = await this.requestObject.getPayload();
    return {
      client_id: this.options.clientMetadata.clientId,
      iat: requestObject.iat ?? this.payload.iat,
      nonce: requestObject.nonce ?? this.payload.nonce,
      state: this.payload.state,
    };
  }
}
