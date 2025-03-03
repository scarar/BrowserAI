/**
 * PDF Parser for extracting text from PDF files
 * Uses PDF.js library for parsing PDF documents in the browser
 */

/* eslint-disable no-console */

// We'll use the PDF.js library which needs to be included in the project
// This interface represents the PDF.js library types we'll use
interface PDFJSStatic {
  getDocument: (source: Uint8Array | { url: string }) => PDFDocumentLoadingTask;
  GlobalWorkerOptions?: {
    workerSrc: string;
  };
  version?: string;
}

interface PDFDocumentLoadingTask {
  promise: Promise<PDFDocumentProxy>;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

interface PDFPageProxy {
  getTextContent: () => Promise<PDFTextContent>;
}

interface PDFTextContent {
  items: Array<{ str: string }>;
}

// Helper function to get the PDF.js library
function getPdfLib(): PDFJSStatic {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be used in browser environments');
  }
  
  const pdfjsLib = (window as any).pdfjsLib;
  
  if (!pdfjsLib) {
    throw new Error('PDF.js library not found. Make sure to include it in your project.');
  }
  
  console.log('PDF.js library found:', pdfjsLib);
  
  // Ensure worker is set
  if (!pdfjsLib.GlobalWorkerOptions || !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    console.warn('PDF.js worker not set, setting default worker');
    pdfjsLib.GlobalWorkerOptions = pdfjsLib.GlobalWorkerOptions || {};
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
  
  return pdfjsLib;
}

// Declare PDF.js as a global variable that will be loaded externally
declare const pdfjsLib: PDFJSStatic;

/**
 * Options for PDF parsing
 */
export interface PDFParseOptions {
  /**
   * Maximum number of pages to parse (default: all pages)
   */
  maxPages?: number;
  
  /**
   * Whether to include page numbers in the output (default: false)
   */
  includePageNumbers?: boolean;
  
  /**
   * Custom page separator (default: "\n\n")
   */
  pageSeparator?: string;
  
  /**
   * Debug mode (default: false)
   */
  debug?: boolean;
}

/**
 * Result of PDF parsing
 */
export interface PDFParseResult {
  /**
   * The extracted text content
   */
  text: string;
  
  /**
   * Number of pages in the document
   */
  numPages: number;
  
  /**
   * Text content by page
   */
  pages: string[];
  
  /**
   * Any errors encountered during parsing
   */
  errors?: string[];
  
  /**
   * Debug information about the parsing process
   */
  debugInfo?: string[];
}

/**
 * PDF Parser class for extracting text from PDF files
 */
export class PDFParser {
  /**
   * Parse a PDF file from a URL
   * 
   * @param url URL of the PDF file to parse
   * @param options Parsing options
   * @returns Promise resolving to the parsed PDF content
   */
  static async parseFromUrl(url: string, options: PDFParseOptions = {}): Promise<PDFParseResult> {
    const debugInfo: string[] = [];
    if (options.debug) debugInfo.push(`Starting URL parsing: ${url}`);
    console.log(`Starting URL parsing: ${url}`);
    
    try {
      // Get PDF.js library
      const pdfjsLib = getPdfLib();
      if (options.debug) debugInfo.push('PDF.js library found');
      
      // Load the PDF document
      if (options.debug) debugInfo.push('Loading PDF document from URL...');
      console.log('Loading PDF document from URL...');
      
      const loadingTask = pdfjsLib.getDocument({ url });
      const pdf = await loadingTask.promise;
      
      if (options.debug) debugInfo.push(`PDF loaded successfully. Pages: ${pdf.numPages}`);
      console.log(`PDF loaded successfully. Pages: ${pdf.numPages}`);
      
      return this.extractTextFromPdf(pdf, options, debugInfo);
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (options.debug) debugInfo.push(`Error: ${errorMessage}`);
      console.error('PDF parsing error:', error);
      
      return {
        text: '',
        numPages: 0,
        pages: [],
        errors: [errorMessage],
        debugInfo: options.debug ? debugInfo : undefined
      };
    }
  }
  
  /**
   * Parse a PDF file from an ArrayBuffer
   * 
   * @param data ArrayBuffer containing the PDF data
   * @param options Parsing options
   * @returns Promise resolving to the parsed PDF content
   */
  static async parseFromData(data: ArrayBuffer, options: PDFParseOptions = {}): Promise<PDFParseResult> {
    const debugInfo: string[] = [];
    if (options.debug) debugInfo.push(`Starting ArrayBuffer parsing. Size: ${data.byteLength} bytes`);
    console.log(`Starting ArrayBuffer parsing. Size: ${data.byteLength} bytes`);
    
    try {
      // Get PDF.js library
      const pdfjsLib = getPdfLib();
      if (options.debug) debugInfo.push('PDF.js library found');
      
      // Convert ArrayBuffer to Uint8Array
      const uint8Array = new Uint8Array(data);
      if (options.debug) debugInfo.push(`Converted to Uint8Array. Length: ${uint8Array.length}`);
      console.log(`Converted to Uint8Array. Length: ${uint8Array.length}`);
      
      // Load the PDF document
      if (options.debug) debugInfo.push('Loading PDF document from data...');
      console.log('Loading PDF document from data...');
      
      try {
        const loadingTask = pdfjsLib.getDocument(uint8Array);
        console.log('Loading task created:', loadingTask);
        
        const pdf = await loadingTask.promise;
        console.log('PDF loaded successfully:', pdf);
        console.log('Number of pages:', pdf.numPages);
        
        if (options.debug) debugInfo.push(`PDF loaded successfully. Pages: ${pdf.numPages}`);
        
        return this.extractTextFromPdf(pdf, options, debugInfo);
      } catch (loadError) {
        console.error('Error loading PDF:', loadError);
        throw loadError;
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (options.debug) debugInfo.push(`Error: ${errorMessage}`);
      console.error('PDF parsing error:', error);
      
      return {
        text: '',
        numPages: 0,
        pages: [],
        errors: [errorMessage],
        debugInfo: options.debug ? debugInfo : undefined
      };
    }
  }
  
  /**
   * Extract text content from a PDF document
   * 
   * @param pdf PDF document proxy
   * @param options Parsing options
   * @returns Promise resolving to the parsed PDF content
   */
  private static async extractTextFromPdf(
    pdf: PDFDocumentProxy, 
    options: PDFParseOptions,
    debugInfo: string[]
  ): Promise<PDFParseResult> {
    const { 
      maxPages = pdf.numPages,
      includePageNumbers = false,
      pageSeparator = '\n\n'
    } = options;
    
    const pageTexts: string[] = [];
    const errors: string[] = [];
    
    // Determine how many pages to process
    const pagesToProcess = Math.min(maxPages, pdf.numPages);
    
    // Process each page
    for (let i = 1; i <= pagesToProcess; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        let pageText = textContent.items.map(item => item.str).join(' ');
        
        // Add page number if requested
        if (includePageNumbers) {
          pageText = `[Page ${i}]\n${pageText}`;
        }
        
        pageTexts.push(pageText);
      } catch (error) {
        errors.push(`Error extracting text from page ${i}: ${(error as Error).message}`);
      }
    }
    
    // Combine all page texts
    const fullText = pageTexts.join(pageSeparator);
    
    return {
      text: fullText,
      numPages: pdf.numPages,
      pages: pageTexts,
      errors: errors.length > 0 ? errors : undefined,
      debugInfo: options.debug ? debugInfo : undefined
    };
  }
  
  /**
   * Loads the PDF.js library from a CDN if not already available
   * @param pdfJsPath Path to the PDF.js library
   * @param workerPath Path to the PDF.js worker
   */
  static async loadPdfJsLibrary(
    pdfJsPath: string = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    workerPath: string = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
  ): Promise<void> {
    // Check if PDF.js is already loaded
    if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
      console.log('PDF.js already loaded, version:', (window as any).pdfjsLib.version);
      
      // Set worker source if not already set
      if (!(window as any).pdfjsLib.GlobalWorkerOptions?.workerSrc) {
        console.log('Setting PDF.js worker source');
        (window as any).pdfjsLib.GlobalWorkerOptions = (window as any).pdfjsLib.GlobalWorkerOptions || {};
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
      }
      return;
    }

    // Load PDF.js from CDN
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('PDF.js can only be loaded in a browser environment'));
        return;
      }

      console.log('Loading PDF.js from CDN:', pdfJsPath);
      const script = document.createElement('script');
      script.src = pdfJsPath;
      script.onload = () => {
        console.log('PDF.js loaded successfully, setting worker source');
        // Set worker source
        (window as any).pdfjsLib.GlobalWorkerOptions = (window as any).pdfjsLib.GlobalWorkerOptions || {};
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
        resolve();
      };
      script.onerror = () => {
        reject(new Error('Failed to load PDF.js library'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Checks if PDF.js is available in the current environment
   */
  static isPdfJsAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).pdfjsLib;
  }
}

/**
 * Utility function to extract text from a PDF file
 * 
 * @param source URL or ArrayBuffer of the PDF file
 * @param options Parsing options
 * @returns Promise resolving to the parsed PDF content
 */
export async function extractTextFromPdf(
  source: string | ArrayBuffer,
  options: PDFParseOptions = {}
): Promise<string> {
  let result: PDFParseResult;
  
  if (typeof source === 'string') {
    result = await PDFParser.parseFromUrl(source, options);
  } else {
    result = await PDFParser.parseFromData(source, options);
  }
  
  return result.text;
}

/**
 * Utility function to extract structured text from a PDF file with page information
 * 
 * @param source URL or ArrayBuffer of the PDF file
 * @param options Parsing options
 * @returns Promise resolving to the parsed PDF content with page information
 */
export async function extractStructuredTextFromPdf(
  source: string | ArrayBuffer,
  options: PDFParseOptions = {}
): Promise<PDFParseResult> {
  if (typeof source === 'string') {
    return await PDFParser.parseFromUrl(source, options);
  } else {
    return await PDFParser.parseFromData(source, options);
  }
}

// Instead, initialize PDF.js when needed in a function
function initializePdfJs() {
  // Only run this in browser environments
  if (typeof window !== 'undefined') {
    // Check if PDF.js is already loaded
    if (!(window as any).pdfjsLib) {
      console.log('PDF.js not loaded, will load on demand when needed');
    }
  }
}

// Call this function instead of using top-level await
initializePdfJs();

/**
 * Processes a PDF file and returns both text and structured data
 * This is a convenience function that handles buffer copying and multiple extractions
 * 
 * @param file The PDF file to process
 * @param options Parsing options
 * @returns An object containing text, structured data, and debug information
 */
export async function processPdfFile(
  file: File,
  options: PDFParseOptions = {}
): Promise<{
  text: string;
  structured: PDFParseResult;
  debugInfo: string[];
}> {
  const debugInfo: string[] = [];
  
  // Validate file
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Invalid file: Must be a PDF');
  }
  
  debugInfo.push(`Processing PDF: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
  
  try {
    // Read the file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    debugInfo.push('File loaded as ArrayBuffer');
    
    // Create copies to prevent detachment issues
    const textBuffer = fileBuffer.slice(0);
    const structuredBuffer = fileBuffer.slice(0);
    
    // Ensure PDF.js is available
    if (!PDFParser.isPdfJsAvailable()) {
      debugInfo.push('PDF.js not available, loading from CDN...');
      await PDFParser.loadPdfJsLibrary();
      debugInfo.push('PDF.js loaded successfully');
    }
    
    // Extract text
    debugInfo.push('Extracting text from PDF...');
    const text = await extractTextFromPdf(textBuffer, options);
    debugInfo.push(`Text extracted successfully (${text.length} characters)`);
    
    // Extract structured data
    debugInfo.push('Extracting structured data...');
    const structured = await extractStructuredTextFromPdf(structuredBuffer, options);
    debugInfo.push(`Structured data extracted (${structured.numPages} pages)`);
    
    return {
      text,
      structured,
      debugInfo
    };
  } catch (error) {
    debugInfo.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
