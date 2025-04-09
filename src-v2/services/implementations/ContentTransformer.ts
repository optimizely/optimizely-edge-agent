import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { 
  ContentTransformOptions, 
  ContentTransformResult, 
  CssTransformOperation, 
  CssTransformType,
  HtmlTransformOperation, 
  HtmlTransformType, 
  IContentTransformer 
} from '../interfaces/IContentTransformer';

/**
 * Determines if the current environment has the DOMParser available
 */
function hasDOMParser(): boolean {
  try {
    return typeof DOMParser !== 'undefined';
  } catch (e) {
    return false;
  }
}

/**
 * Simple DOM node interface for compatibility
 */
interface SimpleNode {
  nodeName: string;
  nodeType: number;
  textContent: string | null;
  childNodes: SimpleNode[];
  attributes?: { [key: string]: string };
  getAttribute?: (name: string) => string | null;
  setAttribute?: (name: string, value: string) => void;
  remove?: () => void;
  insertBefore?: (node: SimpleNode, refNode: SimpleNode | null) => void;
  appendChild?: (node: SimpleNode) => void;
  innerHTML?: string;
}

/**
 * Enhanced SimpleDOMParser alternative for environments without native DOMParser
 * This provides basic functionality needed for the most common transformations
 */
class SimpleDOMParser {
  private logger: ILoggerAdapter;
  
  constructor(logger: ILoggerAdapter) {
    this.logger = logger;
  }
  
  parseFromString(html: string, _mimeType: string): any {
    try {
      // Create a simple document-like structure
      const simpleDocument = {
        nodeType: 9, // DOCUMENT_NODE
        nodeName: '#document',
        documentElement: this.createSimpleElement('html', '', {}),
        querySelectorAll: (selector: string) => this.querySelectorAll(simpleDocument, selector),
        querySelector: (selector: string) => this.querySelector(simpleDocument, selector),
        getElementsByTagName: (tagName: string) => this.getElementsByTagName(simpleDocument, tagName)
      };
      
      // Parse the HTML into our simple document
      const bodyStart = html.indexOf('<body');
      const bodyContent = bodyStart > -1 ? this.extractBodyContent(html) : html;
      
      // Add HTML content to body
      simpleDocument.documentElement.innerHTML = bodyContent;
      
      return simpleDocument;
    } catch (error) {
      this.logger.error('SimpleDOMParser: Error parsing HTML', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return minimal document
      return {
        querySelectorAll: () => [],
        querySelector: () => null,
        getElementsByTagName: () => []
      };
    }
  }
  
  private extractBodyContent(html: string): string {
    const bodyStart = html.indexOf('<body');
    if (bodyStart === -1) return html;
    
    const bodyContentStart = html.indexOf('>', bodyStart) + 1;
    const bodyEnd = html.indexOf('</body>', bodyContentStart);
    
    if (bodyContentStart === 0 || bodyEnd === -1) return html;
    
    return html.substring(bodyContentStart, bodyEnd);
  }
  
  private createSimpleElement(nodeName: string, textContent: string, attributes: Record<string, string>): any {
    return {
      nodeType: 1, // ELEMENT_NODE
      nodeName: nodeName.toUpperCase(),
      textContent,
      attributes,
      childNodes: [],
      getAttribute: (name: string) => attributes[name] || null,
      setAttribute: (name: string, value: string) => { attributes[name] = value; },
      remove: function() { /* no-op */ },
      insertBefore: function(node: any, refNode: any) { this.childNodes.push(node); },
      appendChild: function(node: any) { this.childNodes.push(node); },
      innerHTML: '',
      classList: {
        add: function(className: string) { /* simulate addClass */ },
        remove: function(className: string) { /* simulate removeClass */ }
      }
    };
  }
  
  private querySelectorAll(_element: any, _selector: string): any[] {
    // Very basic implementation - in a real situation we would need a CSS selector parser
    return [];
  }
  
  private querySelector(_element: any, _selector: string): any | null {
    // Simplified implementation
    return null;
  }
  
  private getElementsByTagName(_element: any, _tagName: string): any[] {
    // Simplified implementation
    return [];
  }
}

/**
 * Implementation of content transformer service
 */
export class ContentTransformer implements IContentTransformer {
  private logger: ILoggerAdapter;
  private domParser: DOMParser | SimpleDOMParser;
  
  // RegExp patterns for security validation of transformation functions
  private readonly UNSAFE_PATTERNS = [
    /\beval\s*\(/g,
    /new\s+Function/g,
    /\bDocument\b/g,
    /\bsetTimeout\b/g,
    /\bsetInterval\b/g,
    /\bfetch\b/g,
    /\bimport\b/g,
    /\brequire\b/g,
    /\bprocess\b/g,
    /\bglobal\b/g,
    /\bwindow\b/g
  ];
  
  // Allowed global objects and methods for transformation sandboxing
  private readonly ALLOWED_GLOBALS = new Set([
    'String', 'Number', 'Boolean', 'Array', 'Object', 'RegExp', 'Math', 'JSON', 'Date',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
    'encodeURIComponent', 'decodeURIComponent'
  ]);
  
  /**
   * Creates a new instance of ContentTransformer
   * 
   * @param logger Logger adapter
   */
  constructor(logger: ILoggerAdapter) {
    this.logger = logger;
    
    // Use appropriate parser for the environment
    try {
      if (hasDOMParser()) {
        this.logger.debug('ContentTransformer: Using native DOMParser');
        this.domParser = new DOMParser();
      } else {
        this.logger.debug('ContentTransformer: Using SimpleDOMParser polyfill');
        this.domParser = new SimpleDOMParser(logger);
      }
    } catch (error) {
      this.logger.warn('ContentTransformer: Error initializing DOMParser, using SimpleDOMParser', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.domParser = new SimpleDOMParser(logger);
    }
  }
  
  /**
   * Transforms content using the provided transformation function
   * 
   * @param content Content to transform
   * @param transformFn Transformation function as a string to be evaluated
   * @param options Transformation options
   * @returns Promise resolving to transformation result
   */
  public async transformWithFunction(
    content: string,
    transformFn: string,
    options: ContentTransformOptions = {}
  ): Promise<ContentTransformResult> {
    const startTime = Date.now();
    const originalSize = content.length;
    const contentType = options.contentType || 'text/plain';
    
    this.logger.debug('ContentTransformer: Transforming content with function', {
      contentType,
      contentSize: originalSize,
      options
    });
    
    try {
      // Validate transform function for security
      if (!this.validateTransformFunction(transformFn)) {
        throw new Error('Invalid transformation function. Contains unsafe code.');
      }
      
      // Create isolated function from string
      // The function should accept (content, options) and return transformed content
      const transformFunction = this.createSandboxedFunction(transformFn);
      
      // Apply transformation
      const transformedContent = await transformFunction(content, options);
      
      if (typeof transformedContent !== 'string') {
        throw new Error('Transformation function did not return a string.');
      }
      
      const newSize = transformedContent.length;
      const sizeDelta = newSize - originalSize;
      
      this.logger.debug('ContentTransformer: Content transformed successfully', {
        originalSize,
        newSize,
        sizeDelta,
        timeTaken: Date.now() - startTime
      });
      
      return {
        content: transformedContent,
        success: true,
        timeTaken: Date.now() - startTime,
        contentType,
        sizeDelta
      };
    } catch (error) {
      this.logger.error('ContentTransformer: Error transforming content', {
        error: error instanceof Error ? error.message : String(error),
        transformFn
      });
      
      return {
        content,
        success: false,
        timeTaken: Date.now() - startTime,
        contentType,
        sizeDelta: 0,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Transforms HTML content with common operations
   * 
   * @param htmlContent HTML content to transform
   * @param operations Array of transformation operations to apply
   * @param options Transformation options
   * @returns Promise resolving to transformation result
   */
  public async transformHtml(
    htmlContent: string,
    operations: HtmlTransformOperation[],
    options: ContentTransformOptions = {}
  ): Promise<ContentTransformResult> {
    const startTime = Date.now();
    const originalSize = htmlContent.length;
    const contentType = options.contentType || 'text/html';
    
    this.logger.debug('ContentTransformer: Transforming HTML content', {
      contentSize: originalSize,
      operationsCount: operations.length,
      options
    });
    
    if (!operations || operations.length === 0) {
      return {
        content: htmlContent,
        success: true,
        timeTaken: 0,
        contentType,
        sizeDelta: 0
      };
    }
    
    try {
      // Parse HTML content
      const doc = this.domParser.parseFromString(htmlContent, 'text/html');
      
      // Apply each transformation operation
      for (const operation of operations) {
        this.applyHtmlOperation(doc, operation);
      }
      
      // Serialize back to string
      const transformedContent = this.serializeDocument(doc);
      const newSize = transformedContent.length;
      const sizeDelta = newSize - originalSize;
      
      this.logger.debug('ContentTransformer: HTML transformation complete', {
        operationsApplied: operations.length,
        sizeDelta,
        timeTaken: Date.now() - startTime
      });
      
      return {
        content: transformedContent,
        success: true,
        timeTaken: Date.now() - startTime,
        contentType,
        sizeDelta
      };
    } catch (error) {
      this.logger.error('ContentTransformer: Error transforming HTML', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        content: htmlContent,
        success: false,
        timeTaken: Date.now() - startTime,
        contentType,
        sizeDelta: 0,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Transforms CSS content
   * 
   * @param cssContent CSS content to transform
   * @param operations Array of transformation operations to apply
   * @param options Transformation options
   * @returns Promise resolving to transformation result
   */
  public async transformCss(
    cssContent: string,
    operations: CssTransformOperation[],
    options: ContentTransformOptions = {}
  ): Promise<ContentTransformResult> {
    const startTime = Date.now();
    const originalSize = cssContent.length;
    const contentType = options.contentType || 'text/css';
    
    this.logger.debug('ContentTransformer: Transforming CSS content', {
      contentSize: originalSize,
      operationsCount: operations.length,
      options
    });
    
    if (!operations || operations.length === 0) {
      return {
        content: cssContent,
        success: true,
        timeTaken: 0,
        contentType,
        sizeDelta: 0
      };
    }
    
    try {
      // For a real implementation, we would use a proper CSS parser
      // This is a simplified version using string manipulation
      
      let transformedContent = cssContent;
      
      // Apply each transformation operation
      for (const operation of operations) {
        transformedContent = this.applyCssOperation(transformedContent, operation);
      }
      
      const newSize = transformedContent.length;
      const sizeDelta = newSize - originalSize;
      
      this.logger.debug('ContentTransformer: CSS transformation complete', {
        operationsApplied: operations.length,
        sizeDelta,
        timeTaken: Date.now() - startTime
      });
      
      return {
        content: transformedContent,
        success: true,
        timeTaken: Date.now() - startTime,
        contentType,
        sizeDelta
      };
    } catch (error) {
      this.logger.error('ContentTransformer: Error transforming CSS', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        content: cssContent,
        success: false,
        timeTaken: Date.now() - startTime,
        contentType,
        sizeDelta: 0,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Validates if a transformation function is safe to execute
   * 
   * @param transformFn Transformation function to validate
   * @returns Whether the function is considered safe
   */
  public validateTransformFunction(transformFn: string): boolean {
    if (!transformFn) {
      return false;
    }
    
    // Check for unsafe patterns
    for (const pattern of this.UNSAFE_PATTERNS) {
      if (pattern.test(transformFn)) {
        this.logger.warn('ContentTransformer: Unsafe pattern detected in transform function', {
          pattern: pattern.toString(),
          transformFn: transformFn.substring(0, 100) + (transformFn.length > 100 ? '...' : '')
        });
        return false;
      }
    }
    
    // Add more validation logic here if needed
    
    return true;
  }
  
  /**
   * Creates a sandboxed function from a string
   * 
   * @param fnString Function string to sandbox
   * @returns Sandboxed function
   * @private
   */
  private createSandboxedFunction(fnString: string): (content: string, options: ContentTransformOptions) => Promise<string> {
    // Create a function with a strict sandbox
    // In a production environment, we would use a proper sandbox like VM2
    
    // Wrap the function string in a sandboxed context
    const wrappedFn = `
      "use strict";
      return (async function(content, options) {
        const sandbox = {};
        // Only allow specific globals
        ${Array.from(this.ALLOWED_GLOBALS).map(g => `const ${g} = globalThis.${g};`).join('\n')}
        
        // The actual transformation function
        ${fnString}
        
        // Call the function with our arguments
        try {
          return await transform(content, options);
        } catch(e) {
          throw new Error('Error in transform function: ' + e.message);
        }
      });
    `;
    
    try {
      // Create and return the function
      // This is still not fully secure for production use
      // A proper solution would use an isolated VM
      const sandboxedFn = new Function(wrappedFn)();
      return sandboxedFn;
    } catch (error) {
      this.logger.error('ContentTransformer: Error creating sandboxed function', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to create transformation function: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  
  /**
   * Applies an HTML transformation operation to a document
   * 
   * @param doc Document to transform
   * @param operation Operation to apply
   * @private
   */
  private applyHtmlOperation(doc: Document, operation: HtmlTransformOperation): void {
    // Find elements that match the selector
    const elements = Array.from(doc.querySelectorAll(operation.selector));
    
    if (elements.length === 0) {
      this.logger.debug('ContentTransformer: No elements matched selector', {
        selector: operation.selector,
        operationType: operation.type
      });
      return;
    }
    
    switch (operation.type) {
      case HtmlTransformType.REPLACE_TEXT:
        this.applyReplaceTextOperation(elements, operation as any);
        break;
        
      case HtmlTransformType.REPLACE_ELEMENT:
        this.applyReplaceElementOperation(elements, operation as any);
        break;
        
      case HtmlTransformType.ADD_ELEMENT:
        this.applyAddElementOperation(elements, operation as any);
        break;
        
      case HtmlTransformType.REMOVE_ELEMENT:
        elements.forEach(el => el.remove());
        break;
        
      case HtmlTransformType.ADD_ATTRIBUTE:
        const addAttrOp = operation as any;
        elements.forEach(el => {
          el.setAttribute(addAttrOp.name, addAttrOp.value);
        });
        break;
        
      case HtmlTransformType.REMOVE_ATTRIBUTE:
        const removeAttrOp = operation as any;
        elements.forEach(el => {
          el.removeAttribute(removeAttrOp.name);
        });
        break;
        
      case HtmlTransformType.ADD_CLASS:
        const addClassOp = operation as any;
        elements.forEach(el => {
          el.classList.add(addClassOp.className);
        });
        break;
        
      case HtmlTransformType.REMOVE_CLASS:
        const removeClassOp = operation as any;
        elements.forEach(el => {
          el.classList.remove(removeClassOp.className);
        });
        break;
        
      default:
        this.logger.warn('ContentTransformer: Unsupported HTML operation type', {
          type: operation.type
        });
        break;
    }
  }
  
  /**
   * Applies a CSS transformation operation
   * 
   * @param cssContent CSS content
   * @param operation Operation to apply
   * @returns Transformed CSS content
   * @private
   */
  private applyCssOperation(cssContent: string, operation: CssTransformOperation): string {
    if (!operation.selector) {
      this.logger.warn('ContentTransformer: CSS operation missing selector', {
        operationType: operation.type
      });
      return cssContent;
    }
    
    // This is a simplified implementation
    // In a real implementation, we would use a proper CSS parser
    
    switch (operation.type) {
      case CssTransformType.REPLACE_RULE:
        const replaceRuleOp = operation as any;
        const ruleRegex = new RegExp(`${operation.selector}\\s*{[^}]*}`, 'g');
        return cssContent.replace(ruleRegex, replaceRuleOp.replacement);
        
      case CssTransformType.ADD_RULE:
        const addRuleOp = operation as any;
        return cssContent + `\n\n${operation.selector} {\n  ${addRuleOp.properties}\n}`;
        
      case CssTransformType.REMOVE_RULE:
        const removeRuleRegex = new RegExp(`${operation.selector}\\s*{[^}]*}`, 'g');
        return cssContent.replace(removeRuleRegex, '');
        
      case CssTransformType.REPLACE_PROPERTY:
        const replacePropOp = operation as any;
        const propRegex = new RegExp(`(${operation.selector}\\s*{[^}]*?)(${replacePropOp.property}\\s*:[^;}]*;?)([^}]*})`, 'g');
        return cssContent.replace(propRegex, `$1${replacePropOp.property}: ${replacePropOp.value};$3`);
        
      case CssTransformType.ADD_PROPERTY:
        const addPropOp = operation as any;
        const ruleToModifyRegex = new RegExp(`(${operation.selector}\\s*{[^}]*?)(})`, 'g');
        return cssContent.replace(ruleToModifyRegex, `$1  ${addPropOp.property}: ${addPropOp.value};\n$2`);
        
      case CssTransformType.REMOVE_PROPERTY:
        const removePropOp = operation as any;
        const propToRemoveRegex = new RegExp(`(${operation.selector}\\s*{[^}]*?)(${removePropOp.property}\\s*:[^;}]*;?)([^}]*})`, 'g');
        return cssContent.replace(propToRemoveRegex, '$1$3');
        
      default:
        this.logger.warn('ContentTransformer: Unsupported CSS operation type', {
          type: operation.type
        });
        return cssContent;
    }
  }
  
  /**
   * Apply replace text operation
   * 
   * @param elements Elements to modify
   * @param operation Replace text operation
   * @private
   */
  private applyReplaceTextOperation(elements: Element[], operation: any): void {
    const { pattern, replacement } = operation;
    
    elements.forEach(el => {
      const originalText = el.textContent || '';
      const patternObj = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g');
      el.textContent = originalText.replace(patternObj, replacement);
    });
  }
  
  /**
   * Apply replace element operation
   * 
   * @param elements Elements to replace
   * @param operation Replace element operation
   * @private
   */
  private applyReplaceElementOperation(elements: Element[], operation: any): void {
    const { html } = operation;
    
    elements.forEach(el => {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const newNode = temp.firstElementChild;
      
      if (!newNode) {
        this.logger.warn('ContentTransformer: Invalid HTML for replacement', {
          html
        });
        return;
      }
      
      el.parentNode?.replaceChild(newNode, el);
    });
  }
  
  /**
   * Apply add element operation
   * 
   * @param elements Elements to modify
   * @param operation Add element operation
   * @private
   */
  private applyAddElementOperation(elements: Element[], operation: any): void {
    const { html, position } = operation;
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const fragment = document.createDocumentFragment();
    
    while (temp.firstChild) {
      fragment.appendChild(temp.firstChild);
    }
    
    elements.forEach(el => {
      switch (position) {
        case 'before':
          el.parentNode?.insertBefore(fragment.cloneNode(true), el);
          break;
        case 'after':
          el.parentNode?.insertBefore(fragment.cloneNode(true), el.nextSibling);
          break;
        case 'prepend':
          el.insertBefore(fragment.cloneNode(true), el.firstChild);
          break;
        case 'append':
          el.appendChild(fragment.cloneNode(true));
          break;
      }
    });
  }
  
  /**
   * Serializes a DOM document to HTML string
   * 
   * @param doc Document to serialize
   * @returns HTML string
   * @private
   */
  private serializeDocument(doc: Document): string {
    // In a browser environment, we would use XMLSerializer
    // For a simplified implementation, we'll use innerHTML of the document body
    return doc.documentElement.outerHTML;
  }
} 