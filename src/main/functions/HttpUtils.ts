import { fetch } from 'cross-fetch';

import { AuthorizationResponseResult, JWTPayload, SIOPErrors } from '../types';

export async function postWithBearerToken(url: string, body: JWTPayload, bearerToken: string): Promise<Response> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!response || !response.status || (response.status !== 200 && response.status !== 201)) {
      throw new Error(`${SIOPErrors.RESPONSE_STATUS_UNEXPECTED} ${response.status}:${response.statusText}, ${await response.text()}`);
    }
    return response;
  } catch (error) {
    throw new Error(`${(error as Error).message}`);
  }
}

export async function postAuthorizationResponse(url: string, body: AuthorizationResponseResult): Promise<Response> {
  return postAuthorizationResponseJwt(url, body.idToken);
}

export async function postAuthorizationResponseJwt(url: string, jwt: string): Promise<Response> {
  //fixme: Account for other post types and full AuthzResponse
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: `id_token=${jwt}`,
    });
    if (!response || !response.status || response.status < 200 || response.status >= 400) {
      throw new Error(`${SIOPErrors.RESPONSE_STATUS_UNEXPECTED} ${response.status}:${response.statusText}, ${await response.text()}`);
    }
    return response;
  } catch (error) {
    throw new Error(`${(error as Error).message}`);
  }
}

export async function getWithUrl(url: string, textResponse?: boolean): Promise<Response> {
  return fetch(url)
    .then((response: Response) => {
      if (response.status >= 400) {
        return Promise.reject(Error(`${SIOPErrors.RESPONSE_STATUS_UNEXPECTED} ${response.status}:${response.statusText} URL: ${url}`));
      }
      if (textResponse === true) {
        return response.text();
      }
      return response.json();
    })
    .catch((e) => {
      return Promise.reject(Error(`${(e as Error).message}`));
    });
}

export async function fetchByReferenceOrUseByValue<T>(referenceURI: string, valueObject: T, textResponse?: boolean): Promise<T> {
  let response: T = valueObject;
  if (referenceURI) {
    try {
      response = (await getWithUrl(referenceURI, textResponse)) as unknown as T;
    } catch (e) {
      throw new Error(`${SIOPErrors.REG_PASS_BY_REFERENCE_INCORRECTLY}. URL: ${referenceURI}`);
    }
  }
  return response;
}
