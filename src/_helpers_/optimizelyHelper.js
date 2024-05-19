import * as cookie from "cookie";
import * as cookieDefaultOptions from "../_config_/cookieOptions";
import defaultSettings from "../_config_/defaultSettings";
import Logger from "./logger";
import EventListeners from "../_event_listeners_/eventListeners";
import { AbstractionHelper } from "./abstractionHelper";

let https;
if (defaultSettings.cdnProvider === "akamai") {
  // https = require('https');
}

const DELIMITER = "&";
const FLAG_VAR_DELIMITER = ":";
const KEY_VALUE_DELIMITER = ",";

/**
 * Logs a message and an optional object to the console.
 * @param {string} message - The message to log.
 * @param {Object} [object] - The object to log.
 */
export function log(message, object) {
  const logPrefix = "Optly-CF: ";
  console.log(logPrefix + message, object ? JSON.stringify(object) : "");
}

/**
 * Simulate a fetch operation using a hypothetical httpRequest function for Akamai.
 * @param {string} url - The URL to fetch.
 * @param {Object} options - The options object for the HTTP request.
 * @returns {Promise<any>} - A promise that resolves with the response from the httpRequest.
 */
async function akamaiFetch(url, options) {
  try {
    const response = await httpRequest(url, options);
    if (options.method === "GET") {
      return JSON.parse(response);
    }
    return response;
  } catch (error) {
    console.error("Request failed:", error);
    throw error;
  }
}

/**
 * Fetch data from a specified URL using the HTTPS module tailored for AWS CloudFront.
 * @param {string} url - The URL to fetch.
 * @param {Object} options - The options object for HTTPS request.
 * @returns {Promise<any>} - A promise that resolves with the JSON response or the raw response depending on the method.
 */
function cloudfrontFetch(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.headers["content-type"]?.includes("application/json") && options.method === "GET") {
          resolve(JSON.parse(data));
        } else {
          resolve(data);
        }
      });
    });

    req.on("error", (error) => reject(error));
    if (options.method === "POST" && options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Generic fetch method that delegates to specific fetch implementations based on the CDN provider.
 * @param {Request} request - The incoming request object.
 * @returns {Promise<any>} - A promise that resolves with the response from the fetch operation.
 */
export async function fetchByRequestObject(request) {
  const url = request.url;
  const options = {
    method: request.method,
    headers: request.headers,
    //body: request.body
  };

  switch (defaultSettings.cdnProvider) {
    case "cloudfront":
      return await cloudfrontFetch(request);
    case "akamai":
      return await akamaiFetch(request);
    case "cloudflare":
    case "fastly":
      try {
        const response = await fetch(request);
        // Check if the response was successful
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Clone the response to modify it if necessary
        let clonedResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: AbstractionHelper.getNewHeaders(response),
        });
        return clonedResponse;
      } catch (error) {
        console.error("Request failed:", error);
        throw error;
      }
    default:
      throw new Error("Unsupported CDN provider");
  }
}

/**
 * Generic fetch method that delegates to specific fetch implementations based on the CDN provider.
 * @param {string} url - The URL to fetch.
 * @param {Object} options - The options object for the HTTP request.
 * @returns {Promise<any>} - A promise that resolves with the response from the fetch operation.
 */
export async function fetchByUrl(url, options) {
  switch (defaultSettings.cdnProvider) {
    case "cloudfront":
      return await cloudfrontFetch(url, options);
    case "akamai":
      return await akamaiFetch(url, options);
    case "cloudflare":
    case "fastly":
      try {
        const response = await fetch(url, options);
        if (options.method === "GET") {
          const contentType = response.headers.get("Content-Type");
          if (contentType.includes("application/json")) {
            return await response.json();
          } else if (contentType.includes("text/html")) {
            return await response.text();
          } else if (contentType.includes("application/octet-stream")) {
            return await response.arrayBuffer();
          } else {
            // Handle other content types or fallback to a default
            return await response.text();
          }
        }
        return response;
      } catch (error) {
        console.error("Request failed:", error);
        throw error;
      }
    default:
      throw new Error("Unsupported CDN provider");
  }
}

/**
 * Checks if the given request path matches any of the defined Rest API routes.
 * @param {string} requestPath - The request path to match against the routes.
 * @returns {boolean} - True if the request path matches any route, false otherwise.
 */
export function routeMatches(requestPath) {
  // List all your route patterns here
  const routes = [
    "/v1/api/datafiles/:key",
    "/v1/api/flag_keys",
    "/v1/api/sdk/:sdk_url",
    "/v1/api/variation_changes/:experiment_id/:api_token",
  ];

  /**
   * Checks if the request path matches the given route pattern.
   * @param {string} route - The route pattern to match against.
   * @returns {boolean} - True if the request path matches the route pattern, false otherwise.
   */
  const matchesRoute = (route) => {
    const regex = new RegExp("^" + route.replace(/:\w+/g, "([^/]+)") + "$");
    return regex.test(requestPath);
  };

  // Check for exact or parameterized match
  return routes.some(matchesRoute);
}

/**
 * Retrieves the response JSON key name based on the URL path.
 * @param {string} urlPath - The URL path.
 * @returns {Promise<string>} The response JSON key name.
 */
export async function getResponseJsonKeyName(urlPath) {
  const mappings = {
    "/v1/decide": "decisions",
    "/v1/track": "track",
    "/v1/datafile": "datafile",
    "/v1/config": "config",
    "/v1/batch": "batch_decisions",
    "/v1/send-odp-event": "send_odp_event",
  };
  return mappings[urlPath] || "unknown";
}

/**
 * Clones a response object.
 * @param {Response} responseObject - The response object to clone.
 * @returns {Promise<Response>} The cloned response object.
 */
export async function cloneResponseObject(responseObject) {
  let result;
  result = await new Response(responseObject.body, responseObject);
  return result;
}

// /**
//  * Dispatches an event to the specified URL.
//  * @param {Object} options - The event options.
//  * @param {string} options.url - The URL to dispatch the event to.
//  * @param {Object} options.params - The event parameters.
//  * @returns {Promise<Object>} The response data.
//  */
// export async function dispatchEventToOptimizely({ url, params }) {
// 	const options = {
// 		method: 'POST',
// 		body: JSON.stringify(params),
// 		headers: { 'Content-Type': 'application/json' },
// 	};
// 	const response = await _fetch(url, options);
// 	if (!response.ok) {
// 		throw new Error(`Failed to dispatch event: ${response.statusText}`);
// 	}
// 	return response.json();
// }

/**
 * Checks if an array is valid (non-empty and contains elements).
 * @param {Array} array - The array to check.
 * @returns {boolean} True if the array is valid, false otherwise.
 */
export function arrayIsValid(array) {
  return Array.isArray(array) && array.length > 0;
}

/**
 * Checks if a JSON string represents a valid object.
 * @param {string} json - The JSON string to check.
 * @returns {boolean} True if the JSON represents a valid object, false otherwise.
 */
export function jsonObjectIsValid(json) {
  try {
    const obj = JSON.parse(json);
    return obj && typeof obj === "object";
  } catch {
    return false;
  }
}

/**
 * Generates a UUID.
 * @returns {Promise<string>} The generated UUID.
 */
export async function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Converts days to seconds.
 * @param {number} days - The number of days.
 * @returns {number} The equivalent number of seconds.
 */
export function getDaysInSeconds(days) {
  return Math.max(Number(days), 0) * 86400;
}

// /**
//  * Parses cookies from a cookie header string.
//  * @param {string} cookieHeader - The cookie header string.
//  * @returns {Object} The parsed cookies.
//  */
// export function parseCookies(cookieHeader) {
// 	return cookie.parse(cookieHeader || '');
// }

/**
 * Parses a cookie header string into an object where each property is a cookie name and its value is the cookie's value.
 * This function mimics the basic functionality of the `cookie.parse` method from the cookie npm package.
 *
 * @param {string} cookieHeader - The cookie header string from an HTTP request.
 * @returns {Object} An object representing parsed cookies.
 * @throws {TypeError} Throws an error if the input is not a string.
 */
export function parseCookies(cookieHeader) {
  if (typeof cookieHeader !== "string") {
    throw new TypeError("Cookie header must be a string");
  }

  const cookies = {};
  const cookiePairs = cookieHeader.split(";"); // Split the cookie string into individual cookie pair strings

  cookiePairs.forEach((pair) => {
    const index = pair.indexOf("="); // Find the first '=' to split name and value
    if (index === -1) {
      return; // Skip if no '=' is found
    }
    const name = pair.substring(0, index).trim(); // Extract the cookie name
    const value = pair.substring(index + 1).trim(); // Extract the cookie value
    if (name) {
      // Check if the name is not empty
      cookies[name] = decodeURIComponent(value); // Store the cookie in the object, decoding the value
    }
  });

  return cookies;
}

/**
 * Retrieves the value of a cookie by name.
 * @param {string} cookies - The cookie header string.
 * @param {string} name - The name of the cookie.
 * @returns {string|undefined} The value of the cookie, or undefined if not found.
 */
export function getCookieValueByName(cookies, name) {
  const parsedCookies = parseCookies(cookies);
  let value = parsedCookies[name];
  if (value && value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }
  return value;
}

/**
 * Creates a cookie string with the specified name, value, and options.
 * Default values from `cookieDefaultOptions` are used if specific options are not provided.
 *
 * @param {string} name - The name of the cookie.
 * @param {string} value - The value of the cookie.
 * @param {Object} [options={}] - Additional cookie options such as expires, path, secure, etc.
 * @returns {string} - The created cookie string with all specified and default attributes.
 */
export function createCookie(name, value, options = {}) {
  // Merge provided options with default options to ensure all cookie attributes are set
  const finalOptions = { ...cookieDefaultOptions.default, ...options };

  // Serialize the cookie with all attributes set
  return serializeCookie(name, value, finalOptions);
}

/**
 * Serializes a cookie string with the specified name, value, and options.
 * This function constructs the cookie string in the correct format for HTTP headers.
 *
 * @param {string} name - The name of the cookie.
 * @param {string} value - The value of the cookie.
 * @param {Object} options - Cookie options including expires, maxAge, domain, path, secure, httpOnly, sameSite.
 * @returns {string} - A correctly formatted cookie string for HTTP headers.
 */
function serializeCookie(name, value, options) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options.maxAge) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.secure) {
    parts.push("Secure");
  }
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  return parts.join("; ");
}

/**
 * Splits a string by a delimiter and trims each element.
 * @param {string} input - The input string.
 * @returns {string[]} The split and trimmed array.
 */
export function splitAndTrimArray(input) {
  return input ? input.split(KEY_VALUE_DELIMITER).map((s) => s.trim()) : [];
}

/**
 * Trims each string element in an array.
 * @param {string[]} array - The input array.
 * @returns {string[]} The array with trimmed elements.
 */
export function trimStringArray(array) {
  return arrayIsValid(array) ? array.map((s) => s.trim()) : [];
}

/**
 * Serializes a subset of decision objects based on provided criteria.
 *
 * @param {Array} decisionsArray - Array of decision objects from Optimizely.
 * @param {boolean} excludeVariables - Whether to exclude variables from the serialized decisions.
 * @param {boolean} includeReasons - Whether to include reasons in the serialized decisions.
 * @param {boolean} enabledFlagsOnly - If true, only decisions where the flag is enabled are included.
 * @param {boolean} trimmedDecisions - If true, the userContext is not included in the response JSON
 * @param {string} httpMethod - Request HTTP method
 * @returns {Array} - Array of serialized decision objects.
 */
export function getSerializedArray(
  decisionsArray,
  excludeVariables,
  includeReasons,
  enabledFlagsOnly,
  trimmedDecisions,
  httpMethod
) {
  if (!Array.isArray(decisionsArray)) {
    throw new Error("Invalid input: decisionsArray must be an array.");
  }

  const result = decisionsArray
    .filter((decision) => {
      return (
        (!enabledFlagsOnly || decision.enabled) && // Filter based on flag enabled status
        (httpMethod === "POST" ||
          (httpMethod === "GET" && decision.variationKey && !decision.ruleKey.includes("-rollout-")))
      );
    })
    .map((decision) => {
      let decisionObject = {
        flagKey: decision.flagKey,
        variationKey: decision.variationKey,
        ruleKey: decision.ruleKey,
        enabled: decision.enabled,
      };

      if (!excludeVariables) {
        decisionObject.variables = decision.variables;
      }

      if (includeReasons) {
        decisionObject.reasons = decision.reasons;
      }

      if (!trimmedDecisions) {
        decisionObject.userContext = decision.userContext;
      }

      return decisionObject;
    });

  return result;
}

/**
 * Retrieves the flag keys to decide based on stored decisions and active flags.
 * It filters out any cookie stored decision whose flag key is active in the datafile.
 * @param {Object[]} storedDecisions - The array of stored decision objects.
 * @param {string[]} activeFlags - The array of active flag keys.
 * @returns {string[]} The flag keys to decide.
 */
export function getFlagsToDecide(storedDecisions, activeFlags) {
  if (!arrayIsValid(storedDecisions) || !arrayIsValid(activeFlags)) {
    return activeFlags || [];
  }
  const activeFlagsSet = new Set(activeFlags);
  return storedDecisions
    .filter((decision) => !activeFlagsSet.has(decision.flagKey))
    .map((decision) => decision.flagKey);
}

/**
 * Retrieves the invalid decisions based on active flags.
 * @param {Object[]} decisions - The array of decision objects.
 * @param {string[]} activeFlags - The array of active flag keys.
 * @returns {Object[]} The invalid decisions.
 */
export function getInvalidCookieDecisions(decisions, activeFlags) {
  const activeFlagsSet = new Set(activeFlags); // Convert activeFlags to a Set
  return decisions.filter((decision) => !activeFlagsSet.has(decision.flagKey));
}

/**
 * Retrieves the valid stored decisions based on active flags.
 * @param {Object[]} decisions - The array of decision objects.
 * @param {string[]} activeFlags - The array of active flag keys.
 * @returns {Object[]} The valid stored decisions.
 */
export function getValidCookieDecisions(decisions, activeFlags) {
  const activeFlagsSet = new Set(activeFlags); // Convert activeFlags to a Set
  return decisions.filter((decision) => activeFlagsSet.has(decision.flagKey));
}

/**
 * Serializes an array of decision objects into a string.
 * @param {Object[]} decisions - The array of decision objects.
 * @returns {string|undefined} The serialized string, or undefined if the input array is invalid.
 */
export function serializeDecisions(decisions) {
  if (!arrayIsValid(decisions)) {
    return undefined;
  }
  return decisions
    .map((d) => `${d.flagKey}${FLAG_VAR_DELIMITER}${d.variationKey}${FLAG_VAR_DELIMITER}${d.ruleKey}`)
    .join(DELIMITER);
}

/**
 * Deserializes a string into an array of decision objects.
 * @param {string} input - The serialized string.
 * @returns {Object[]} The deserialized array of decision objects.
 */
export function deserializeDecisions(input) {
  if (!input) return [];

  const decisions = [];
  const items = input.split(DELIMITER);

  for (const item of items) {
    const parts = item.split(FLAG_VAR_DELIMITER);
    if (parts.length === 3) {
      // Ensure each item has exactly three parts
      const [flagKey, variationKey, ruleKey] = parts;
      decisions.push({ flagKey, variationKey, ruleKey });
    }
  }

  return decisions;
}

/**
 * Safely stringifies an object into a JSON string.
 * @param {Object} data - The object to stringify.
 * @returns {string} The JSON string representation of the object.
 */
export function jsonStringifySafe(data) {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.error("Failed to stringify JSON:", error);
    return "{}";
  }
}

/**
 * Safely parses a JSON string into an object.
 * @param {string} jsonString - The JSON string to parse.
 * @returns {Object|null} The parsed object, or null if parsing fails.
 */
export function jsonParseSafe(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return null;
  }
}

/**
 * Checks if a string represents a valid JSON object.
 *
 * @param {string} obj - The string to check.
 * @returns {boolean} True if the string represents a valid non-empty object, false otherwise.
 * @throws {TypeError} If the input is not a string.
 *
 * @example
 * isJsonObjectValid('{"name": "John", "age": 30}'); // true
 * isJsonObjectValid('{}'); // false
 * isJsonObjectValid('123'); // false
 * isJsonObjectValid('null'); // false
 * isJsonObjectValid('undefined'); // false
 * isJsonObjectValid(123); // throws TypeError
 */
export function isValidJsonObject(obj) {
  try {
    if (typeof obj !== "string") {
      throw new TypeError("Input must be a string");
    }

    const result = JSON.parse(obj);

    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return false;
    }

    return Object.keys(result).length > 0;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return false;
    }
    console.error("An error occurred while validating the JSON object:", error);
    throw error;
  }
}
/**
 * Checks if the given parameter is a valid non-empty JavaScript object.
 * @param {*} obj - The parameter to be checked.
 * @returns {boolean} - Returns true if the parameter is a valid non-empty object, false otherwise.
 * @throws {Error} - If an error occurs during the validation process.
 */
export function isValidObject(obj) {
  try {
    // Check if the parameter is an object and not null
    if (typeof obj === "object" && obj !== null) {
      // Check if the object has any properties
      if (Object.keys(obj).length > 0) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Error validating object:", error);
    throw new Error("An error occurred while validating the object.");
  }
}
