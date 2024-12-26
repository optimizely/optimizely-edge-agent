# Cookie options for Optimizely Edge Agent
**Disclaimer:** This website requires Please enable JavaScript in your browser settings for the best experience.

The availability of features may depend on your plan type. Contact your Customer Success Manager if you have any questions.

Describes the default settings for cookies in Optimizely Edge Agent and how to override them.

> 👍
> 
> Beta
> 
> 
> ----------
> 
> Optimizely Edge Agent is in beta. Apply on the [Optimizely beta signup page](https://www.optimizely.com/beta) or contact your Customer Success Manager.

The `cookieOptions` module specifies the default options for setting cookies within Optimizely Edge Agent. This module provides a standard cookie configuration, ensuring consistency and security across different environments.

Optimizely Edge Agent uses the default cookie options when you create cookies. However, you can override these defaults by passing your options in the relevant function and method calls to customizes the cookie behavior for your requirements.

The `cookieDefaultOptions` object contains the default settings for cookies used by Optimizely Edge Agent. The following is a detailed description of each option:

```
/**
 * @module cookieOptions
 *
 * The CookieOptions specifies the default options for the cookies. *
 */

const cookieDefaultOptions = {
    path: '/', // Default path for the cookie.
    expires: new Date(Date.now() + 86400e3 * 365), // Sets expiration date to 365 days from now.
    maxAge: 86400 * 365, // Maximum age of the cookie in seconds (365 days).
    domain: '.expedge.com', // Domain where the cookie is valid.
    secure: true, // Indicates if the cookie should be sent over secure protocol only.
    httpOnly: true, // Indicates that the cookie is accessible only through the HTTP protocol.
    sameSite: 'none', // Cross-site request setting for the cookie.
    // Options are:
    // - "Strict": The cookie will only be sent along with "same-site" requests.
    // - "Lax": The cookie is not sent on cross-site requests except when navigating to the target site.
    // - "None": The cookie will be sent on both same-site and cross-site requests. Requires `Secure` to be true.
};

export default cookieDefaultOptions;

```


*   `path`
    *   **Type** – String
    *   **Default** – `'/'`
    *   **Description** – Specifies the URL path in the requested URL for the browser to send the Cookie header. Setting this to `'/'` makes the cookie available to the entire domain.
*   `expires`
    *   **Type** – Date
    *   **Default** – `new Date(Date.now() + 86400e3 \* 365)`
    *   **Description** – Sets the expiration date of the cookie. This is set to 365 days from the current date, meaning the cookie expires after one year.
*   `maxAge`
    *   **Type** – Number
    *   **Default** – `86400 \* 365`
    *   **Description** – Sets the maximum age of the cookie in seconds. This value is set to 365 days (86400 seconds per day), matching the `expires` attribute.
*   `domain`
    *   **Type** – String
    *   **Default** – `.expedge.com`
    *   **Description** – Specifies the domain within which this cookie is valid. The leading dot (.) authorizes the cookie to be valid for subdomains of `expedge.com`.
*   `secure`
    *   **Type** – Boolean
    *   **Default** – `true`
    *   **Description** – Indicates whether the cookie should only be transmitted over secure protocols such as HTTPS. Setting this to `true` enhances the security of the cookie by ensuring it is only sent over encrypted connections.
*   `httpOnly`
    *   **Type** – Boolean
    *   **Default** – `true`
    *   **Description** – Restricts the cookie from being accessed through JavaScript through the `Document.cookie` property. This helps mitigate the risk of client-side script attacks, such as cross-site scripting (XSS).
*   `sameSite`
    *   **Type** – String
    *   **Default** – none
    *   **Description** – Controls the cross-site request behavior of the cookie. It can take one of the following values:
        *   `strict` – The cookie is only sent with same-site requests.
        *   `lax` – The cookie is not sent on cross-site requests except when navigating to the target site.
        *   `none` – The cookie is sent on both same-site and cross-site requests. When `none` is set, the `secure` attribute must also be true.

The `cookieDefaultOptions` object is exported as the module's default export, making it easy to import and use in other parts of the application.

```
export default cookieDefaultOptions;

```


To use the default cookie options in your application, import the `cookieDefaultOptions` module and apply it when setting cookies:

```
function setCookie(name, value) {
    document.cookie = `${name}=${value}; path=${
        cookieDefaultOptions.path
    }; expires=${cookieDefaultOptions.expires.toUTCString()}; max-age=${cookieDefaultOptions.maxAge}; domain=${
        cookieDefaultOptions.domain
    }; secure=${cookieDefaultOptions.secure}; httpOnly=${cookieDefaultOptions.httpOnly}; sameSite=${
        cookieDefaultOptions.sameSite
    }`;
}

```


This ensures that cookies within the application adhere to predefined security and behavior standards.

Updated about 2 months ago

* * *

*   [Table of Contents](#)
*   *   [Default cookie options](#default-cookie-options)
    *   [Option Descriptions](#option-descriptions)
    *   [Export](#export)
    *   [Usage](#usage)