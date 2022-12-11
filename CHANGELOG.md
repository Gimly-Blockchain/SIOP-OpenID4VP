# Release Notes
The DID Auth SIOP typescript library is still in an alpha state at this point. Please note that the interfaces might still change a bit as the software still is in active development.

## v0.2.14 - 2022-10-27

- Updated:
  - Updated some dependencies

## v0.2.13 - 2022-08-15

- Updated:
  - Updated some dependencies


## v0.2.12 - 2022-07-07

- Fixed:
  - We did not check the proper claims in an AuthResponse to determine the key type, resulting in an invalid JWT header
  - Removed some remnants of the DID-jwt fork


## v0.2.11 - 2022-07-01

- Updated:
  - Update to PEX 1.1.2
  - Update several other deps
- Fixed:
  - Only throw a PEX error in case PEX itself has flagged the submission to be in error
  - Use nonce from request in response if available
  - Remove DID-JWT fork as the current version supports SIOPv2 iss values


## v0.2.10 - 2022-02-25

- Added:
  - Add default resolver support to builder


## v0.2.9 - 2022-02-23

- Fixed:
  - Remove did-jwt dependency, since we use an internal fork for the time being anyway

## v0.2.7 - 2022-02-11

- Fixed:
  - Revert back to commonjs


## v0.2.6 - 2022-02-10

- Added:
  - Supplied signature support. Allowing to integrate signature callbacks, next to supplying private keys or using external custodial signing with authn/authz


## v0.2.5 - 2022-01-26

- Updated:
  - Update @sphereon/pex to the latest stable version v1.0.2
  - Moved did-key dep to dev dependency and changed to @digitalcredentials/did-method-key


## v0.2.4 - 2022-01-13

- Updated:
  - Update @sphereon/pex to latest stable version v1.0.1

## v0.2.3 - 2021-12-10

- Fixed:
  - Check nonce and did support first before verifying JWT

- Updated:
  * Updated PEX dependency that fixed a JSON-path bug impacting us


## v0.2.2 - 2021-11-29

- Updated:
  * Updated dependencies

## v0.2.1 - 2021-11-28

- Updated:
  * Presentation Exchange updated to latest PEX version 0.5.x. The eventual Presentation is not a VP yet (proof will be in next minor release)
  * Update Uni Resolver client to latest version 0.3.3

## v0.2.0 - 2021-10-06

- Added:
  * Presentation Exchange support [OpenID Connect for Verifiable Presentations(https://openid.net/specs/openid-connect-4-verifiable-presentations-1_0.html)
  
- Fixed:
  * Many bug fixes (see git history)

## v0.1.1 - 2021-09-29

- Fixed:
  * Packaging fix for the did-jwt fork we include for now

## v0.1.0 - 2021-09-29
This is the first Alpha release of the DID Auth SIOP typescript library. Please note that the interfaces might still change a bit as the software still is in active development.

- Alpha release:
    * Low level Auth Request and Response service classes
    * High Level OP and RP role service classes
    * Support for most of [SIOPv2](https://openid.net/specs/openid-connect-self-issued-v2-1_0.html)

- Planned for Beta:
    * [Support for OpenID Connect for Verifiable Presentations](https://openid.net/specs/openid-connect-4-verifiable-presentations-1_0.html)
