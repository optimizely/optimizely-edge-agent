/**
 * @module CookieOptions
 * 
 * The CookieOptions specifies the default options for the cookies. * 
 */

const cookieDefaultOptions = {
    path: "/",                        // Default path for the cookie.
    expires: new Date(Date.now() + 86400e3 * 365), // Sets expiration date to 365 days from now.
    maxAge: 86400 * 365,              // Maximum age of the cookie in seconds (365 days).
    domain: ".expedge.com",     // Domain where the cookie is valid.
    secure: true,                     // Indicates if the cookie should be sent over secure protocol only.
    httpOnly: true,                   // Indicates that the cookie is accessible only through the HTTP protocol.
    sameSite: "none"                  // Cross-site request setting for the cookie. 
                                      // Options are:
                                      // - "Strict": The cookie will only be sent along with "same-site" requests.
                                      // - "Lax": The cookie is not sent on cross-site requests except when navigating to the target site.
                                      // - "None": The cookie will be sent on both same-site and cross-site requests. Requires `Secure` to be true.
  };
  
  export default cookieDefaultOptions;
  

