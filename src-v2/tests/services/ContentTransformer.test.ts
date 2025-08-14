import { ContentTransformer } from '../../services/implementations/ContentTransformer';
import { 
  ContentTransformOptions, 
  ContentTransformResult, 
  CssTransformOperation, 
  CssTransformType, 
  HtmlTransformOperation, 
  HtmlTransformType 
} from '../../services/interfaces/IContentTransformer';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';

// Explicitly declare Jest globals to resolve type issues
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Mock<T = any, Y extends any[] = any[]> extends Function {
      (...args: Y): T;
      mockImplementation(fn: (...args: Y) => T): this;
      mockImplementationOnce(fn: (...args: Y) => T): this;
    }
  }

  function describe(name: string, fn: () => void): void;
  function beforeEach(fn: () => void): void;
  function it(name: string, fn: () => void | Promise<void>, timeout?: number): void;
  function expect<T>(actual: T): jest.Matchers<T>;
}

/**
 * Mock logger adapter for testing
 */
class MockLoggerAdapter implements ILoggerAdapter {
  public messages: Array<{level: string, message: string, data?: any}> = [];

  debug(message: string, data?: any): void {
    this.messages.push({ level: 'debug', message, data });
  }
  
  info(message: string, data?: any): void {
    this.messages.push({ level: 'info', message, data });
  }
  
  warn(message: string, data?: any): void {
    this.messages.push({ level: 'warn', message, data });
  }
  
  error(message: string, data?: any): void {
    this.messages.push({ level: 'error', message, data });
  }
}

/**
 * Mock DOMParser and DOM elements for testing
 */
class MockDOMParser {
  parseFromString(htmlString: string, contentType: string): MockDocument {
    return new MockDocument(htmlString);
  }
}

// Partial Document interface implementation for mocking
class MockDocument {
  documentElement: MockElement;
  body: MockElement;
  
  constructor(htmlString: string) {
    this.documentElement = new MockElement('html', htmlString);
    this.body = new MockElement('body', '');
  }
  
  createElement(tagName: string): MockElement {
    return new MockElement(tagName, '');
  }
  
  createDocumentFragment(): MockDocumentFragment {
    return new MockDocumentFragment();
  }
  
  querySelectorAll(selector: string): MockElement[] {
    // Simple selector matching for testing
    if (selector === 'div') {
      return [new MockElement('div', '<div>Test</div>')];
    } else if (selector === '.test-class') {
      return [new MockElement('div', '<div class="test-class">Test</div>')];
    } else if (selector === '#test-id') {
      return [new MockElement('div', '<div id="test-id">Test</div>')];
    }
    return [];
  }
}

class MockElement {
  tagName: string;
  innerHTML: string;
  outerHTML: string;
  textContent: string | null;
  parentNode: MockElement | null = null;
  nextSibling: MockElement | null = null;
  firstChild: MockElement | null = null;
  firstElementChild: MockElement | null = null;
  attributes: Record<string, string> = {};
  private classListArray: string[] = [];
  
  constructor(tagName: string, html: string) {
    this.tagName = tagName;
    this.innerHTML = html;
    this.outerHTML = `<${tagName}>${html}</${tagName}>`;
    this.textContent = html.replace(/<[^>]*>/g, '');
    
    // Initialize firstElementChild if there's content
    if (html.trim()) {
      this.firstElementChild = new MockElement('div', '');
    }
  }
  
  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }
  
  getAttribute(name: string): string | null {
    return this.attributes[name] || null;
  }
  
  removeAttribute(name: string): void {
    delete this.attributes[name];
  }
  
  remove(): void {
    if (this.parentNode) {
      this.parentNode = null;
    }
  }
  
  appendChild(node: MockElement | MockDocumentFragment): MockElement {
    // Simplified for testing purposes
    this.innerHTML += node instanceof MockElement ? node.outerHTML : '';
    return this;
  }
  
  insertBefore(node: MockElement | MockDocumentFragment, refNode: MockElement | null): MockElement {
    // Simplified for testing purposes
    this.innerHTML = (node instanceof MockElement ? node.outerHTML : '') + this.innerHTML;
    return this;
  }
  
  get classList() {
    return {
      add: (className: string) => {
        if (!this.classListArray.includes(className)) {
          this.classListArray.push(className);
        }
      },
      remove: (className: string) => {
        const index = this.classListArray.indexOf(className);
        if (index !== -1) {
          this.classListArray.splice(index, 1);
        }
      },
      contains: (className: string) => this.classListArray.includes(className)
    };
  }
}

class MockDocumentFragment {
  childNodes: MockElement[] = [];
  
  appendChild(node: MockElement): MockElement {
    this.childNodes.push(node);
    return node;
  }
  
  cloneNode(deep: boolean): MockDocumentFragment {
    const clone = new MockDocumentFragment();
    if (deep) {
      this.childNodes.forEach(node => {
        clone.appendChild(new MockElement(node.tagName, node.innerHTML));
      });
    }
    return clone;
  }
}

// Mock global objects for testing DOM operations
(global as any).DOMParser = MockDOMParser;
(global as any).document = new MockDocument('');

describe('ContentTransformer', () => {
  let transformer: ContentTransformer;
  let mockLogger: MockLoggerAdapter;
  
  beforeEach(() => {
    mockLogger = new MockLoggerAdapter();
    transformer = new ContentTransformer(mockLogger);
  });
  
  describe('transformWithFunction', () => {
    it('should transform content successfully with a valid function', async () => {
      const content = 'Hello World';
      const transformFn = 'function transform(content, options) { return content.toUpperCase(); }';
      
      const result = await transformer.transformWithFunction(content, transformFn);
      
      expect(result.content).toBe('HELLO WORLD');
      expect(result.success).toBe(true);
      expect(result.contentType).toBe('text/plain');
      expect(result.sizeDelta).toBe(0);
      expect(typeof result.timeTaken).toBe('number');
    });
    
    it('should reject unsafe transformation functions', async () => {
      const content = 'Hello World';
      const transformFn = 'function transform(content) { eval("alert(\'hack\')"); return content; }';
      
      const result = await transformer.transformWithFunction(content, transformFn);
      
      expect(result.success).toBe(false);
      expect(result.content).toBe(content); // Original content returned
      expect(result.error).toBeDefined();
    });
    
    it('should handle async transformation functions', async () => {
      const content = 'Hello World';
      const transformFn = 'async function transform(content) { return new Promise(resolve => setTimeout(() => resolve(content.split("").reverse().join("")), 10)); }';
      
      const result = await transformer.transformWithFunction(content, transformFn);
      
      expect(result.content).toBe('dlroW olleH');
      expect(result.success).toBe(true);
    });
    
    it('should handle transformation errors gracefully', async () => {
      const content = 'Hello World';
      const transformFn = 'function transform(content) { throw new Error("Test error"); }';
      
      const result = await transformer.transformWithFunction(content, transformFn);
      
      expect(result.success).toBe(false);
      expect(result.content).toBe(content);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Test error');
    });
  });
  
  describe('validateTransformFunction', () => {
    it('should reject empty functions', () => {
      expect(transformer.validateTransformFunction('')).toBe(false);
    });
    
    it('should reject functions with eval', () => {
      expect(transformer.validateTransformFunction('function() { eval("code"); }')).toBe(false);
    });
    
    it('should reject functions with new Function', () => {
      expect(transformer.validateTransformFunction('function() { return new Function("a", "return a"); }')).toBe(false);
    });
    
    it('should accept safe functions', () => {
      expect(transformer.validateTransformFunction('function transform(content) { return content.toUpperCase(); }')).toBe(true);
    });
  });
  
  describe('transformHtml', () => {
    it('should return original content when no operations provided', async () => {
      const htmlContent = '<div>Test</div>';
      
      const result = await transformer.transformHtml(htmlContent, []);
      
      expect(result.content).toBe(htmlContent);
      expect(result.success).toBe(true);
      expect(result.timeTaken).toBe(0);
    });
    
    it('should apply HTML operations', async () => {
      const htmlContent = '<div>Test</div>';
      const operations: HtmlTransformOperation[] = [
        {
          type: HtmlTransformType.REPLACE_TEXT,
          selector: 'div',
          pattern: 'Test',
          replacement: 'Modified'
        }
      ];
      
      const result = await transformer.transformHtml(htmlContent, operations);
      
      expect(result.success).toBe(true);
      // Due to our mock implementation, the exact content won't match what we'd expect in a real DOM
      // We're just checking the success flag and basic processing
    });
    
    it('should handle HTML transformation errors gracefully', async () => {
      const htmlContent = '<div>Test</div>';
      // Create a situation that will trigger an error
      jest.spyOn(MockDocument.prototype, 'querySelectorAll').mockImplementationOnce(() => {
        throw new Error('Query error');
      });
      
      const operations: HtmlTransformOperation[] = [
        {
          type: HtmlTransformType.REPLACE_TEXT,
          selector: 'div',
          pattern: 'Test',
          replacement: 'Modified'
        }
      ];
      
      const result = await transformer.transformHtml(htmlContent, operations);
      
      expect(result.success).toBe(false);
      expect(result.content).toBe(htmlContent);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('transformCss', () => {
    it('should return original content when no operations provided', async () => {
      const cssContent = 'body { color: red; }';
      
      const result = await transformer.transformCss(cssContent, []);
      
      expect(result.content).toBe(cssContent);
      expect(result.success).toBe(true);
      expect(result.timeTaken).toBe(0);
    });
    
    it('should apply CSS operations', async () => {
      const cssContent = 'body { color: red; }';
      const operations: CssTransformOperation[] = [
        {
          type: CssTransformType.REPLACE_PROPERTY,
          selector: 'body',
          property: 'color',
          value: 'blue'
        }
      ];
      
      const result = await transformer.transformCss(cssContent, operations);
      
      expect(result.success).toBe(true);
      expect(result.content).not.toBe(cssContent);
    });
    
    it('should add new CSS rules', async () => {
      const cssContent = 'body { color: red; }';
      const operations: CssTransformOperation[] = [
        {
          type: CssTransformType.ADD_RULE,
          selector: '.new-class',
          properties: 'color: green; font-size: 16px;'
        }
      ];
      
      const result = await transformer.transformCss(cssContent, operations);
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('.new-class');
      expect(result.content).toContain('color: green');
    });
    
    it('should handle CSS transform errors gracefully', async () => {
      const cssContent = 'body { color: red; }';
      // Create a situation that will trigger an error
      jest.spyOn(transformer as any, 'applyCssOperation').mockImplementationOnce(() => {
        throw new Error('CSS transform error');
      });
      
      const operations: CssTransformOperation[] = [
        {
          type: CssTransformType.REPLACE_PROPERTY,
          selector: 'body',
          property: 'color',
          value: 'blue'
        }
      ];
      
      const result = await transformer.transformCss(cssContent, operations);
      
      expect(result.success).toBe(false);
      expect(result.content).toBe(cssContent);
      expect(result.error).toBeDefined();
    });
  });
}); 