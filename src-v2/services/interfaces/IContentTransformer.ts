/**
 * Content transformation options
 */
export interface ContentTransformOptions {
  /** Encoding of the content (default: 'utf-8') */
  encoding?: string;
  
  /** Content type (e.g., 'text/html', 'text/css', etc.) */
  contentType?: string;
  
  /** Original URL of the content (for path resolution) */
  sourceUrl?: string;
  
  /** Whether to minify the output */
  minify?: boolean;
  
  /** Additional custom parameters for transformation */
  params?: Record<string, any>;
}

/**
 * Result of a content transformation operation
 */
export interface ContentTransformResult {
  /** The transformed content */
  content: string;
  
  /** Whether the transformation was successful */
  success: boolean;
  
  /** Time taken to transform in milliseconds */
  timeTaken: number;
  
  /** Content type of the output */
  contentType: string;
  
  /** Error details if transformation failed */
  error?: Error;
  
  /** Size difference after transformation (negative means smaller) */
  sizeDelta?: number;
}

/**
 * @interface IContentTransformer
 * @description Service responsible for transforming content using various
 * strategies, including custom functions, scripts, and pre-defined transformations.
 */
export interface IContentTransformer {
  /**
   * Transforms content using the provided transformation function
   * 
   * @param content Content to transform
   * @param transformFn Transformation function as a string to be evaluated
   * @param options Transformation options
   * @returns Promise resolving to transformation result
   */
  transformWithFunction(
    content: string,
    transformFn: string,
    options?: ContentTransformOptions
  ): Promise<ContentTransformResult>;
  
  /**
   * Transforms HTML content with common operations
   * 
   * @param htmlContent HTML content to transform
   * @param operations Array of transformation operations to apply
   * @param options Transformation options
   * @returns Promise resolving to transformation result
   */
  transformHtml(
    htmlContent: string,
    operations: HtmlTransformOperation[],
    options?: ContentTransformOptions
  ): Promise<ContentTransformResult>;
  
  /**
   * Transforms CSS content
   * 
   * @param cssContent CSS content to transform
   * @param operations Array of transformation operations to apply
   * @param options Transformation options
   * @returns Promise resolving to transformation result
   */
  transformCss(
    cssContent: string,
    operations: CssTransformOperation[],
    options?: ContentTransformOptions
  ): Promise<ContentTransformResult>;
  
  /**
   * Validates if a transformation function is safe to execute
   * 
   * @param transformFn Transformation function to validate
   * @returns Whether the function is considered safe
   */
  validateTransformFunction(transformFn: string): boolean;
}

/**
 * HTML transformation operation types
 */
export enum HtmlTransformType {
  REPLACE_TEXT = 'replace_text',
  REPLACE_ELEMENT = 'replace_element',
  ADD_ELEMENT = 'add_element',
  REMOVE_ELEMENT = 'remove_element',
  ADD_ATTRIBUTE = 'add_attribute',
  REMOVE_ATTRIBUTE = 'remove_attribute',
  ADD_CLASS = 'add_class',
  REMOVE_CLASS = 'remove_class',
  WRAP_ELEMENT = 'wrap_element',
  UNWRAP_ELEMENT = 'unwrap_element',
  ADD_STYLE = 'add_style',
  PREPEND_HTML = 'prepend_html',
  APPEND_HTML = 'append_html'
}

/**
 * Base HTML transformation operation
 */
export interface HtmlTransformOperation {
  /** Type of transformation */
  type: HtmlTransformType;
  
  /** CSS selector to target elements */
  selector: string;
}

/**
 * Replace text operation
 */
export interface ReplaceTextOperation extends HtmlTransformOperation {
  type: HtmlTransformType.REPLACE_TEXT;
  
  /** Pattern to search for (string or regex) */
  pattern: string | RegExp;
  
  /** Replacement text */
  replacement: string;
}

/**
 * Replace element operation
 */
export interface ReplaceElementOperation extends HtmlTransformOperation {
  type: HtmlTransformType.REPLACE_ELEMENT;
  
  /** HTML to replace the selected element with */
  html: string;
}

/**
 * Add element operation
 */
export interface AddElementOperation extends HtmlTransformOperation {
  type: HtmlTransformType.ADD_ELEMENT;
  
  /** HTML to add */
  html: string;
  
  /** Position relative to selector ('before', 'after', 'prepend', 'append') */
  position: 'before' | 'after' | 'prepend' | 'append';
}

/**
 * CSS transformation operation types
 */
export enum CssTransformType {
  REPLACE_RULE = 'replace_rule',
  ADD_RULE = 'add_rule',
  REMOVE_RULE = 'remove_rule',
  REPLACE_PROPERTY = 'replace_property',
  ADD_PROPERTY = 'add_property',
  REMOVE_PROPERTY = 'remove_property'
}

/**
 * Base CSS transformation operation
 */
export interface CssTransformOperation {
  /** Type of transformation */
  type: CssTransformType;
  
  /** CSS selector to target */
  selector?: string;
} 