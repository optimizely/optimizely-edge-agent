# Codebase Documentation Generator

This folder contains tools for generating comprehensive documentation from codebase analysis markdown files.

## `create-codebase-pdf.sh`

A bash script that compiles markdown documentation from the `codebase-analysis` directory into a professional, well-formatted PDF report.

### Features

- Converts all markdown files in the codebase-analysis folder into a single coherent document
- Renders Mermaid diagrams as images in the final PDF
- Processes markdown tables for better PDF formatting
- Converts component inventory tables into structured lists for better readability
- Generates a professional table of contents
- Adds proper page breaks between sections
- Creates both a combined markdown file and a formatted PDF

### Prerequisites

- Bash shell environment
- `pandoc` for markdown to PDF conversion
- `texlive` or similar LaTeX distribution (for PDF generation)
- Node.js (for Mermaid diagram rendering, if applicable)

The script will automatically install `mermaid-cli` if it's not already available.

### Usage

```bash
./create-codebase-pdf.sh [-a APP_NAME] [-t APP_TITLE] [-o OUTPUT_DIR]
```

#### Parameters

- `-a APP_NAME` - The application name to use in the document (default: "Mando")
- `-t APP_TITLE` - The title to display at the top of the document (default: "APPLICATION")
- `-o OUTPUT_DIR` - The directory where output files will be saved (default: "./codebase-analysis")

#### Examples

Basic usage with defaults:
```bash
./create-codebase-pdf.sh
```

Customized usage:
```bash
./create-codebase-pdf.sh -a "MyApp" -t "MY APPLICATION" -o "./documentation"
```

### Input Structure

The script expects markdown files to be organized in the following directory structure:

```
codebase-analysis/
├── 00-executive-summary/
├── 01-overview/
├── 02-structure/
├── 03-frontend/
├── 03-data/
├── 04-backend/
├── 04-routing/
├── 04-performance/
├── 05-ui/
├── 05-serverless/
├── 06-data/
├── 07-security/
├── 08-patterns/
├── 09-quality/
├── 10-cross-cutting/
└── 11-recommendations/
```

Each folder should contain relevant markdown files that will be compiled in alphanumeric order.

### Output Files

The script generates two output files:

1. `${APP_NAME,,}-codebase-analysis.md` - The combined markdown file
2. `${APP_NAME}-Codebase-Analysis.pdf` - The formatted PDF document

Both files are saved to the specified output directory.

### Special Processing

- **Mermaid Diagrams**: Any Mermaid code blocks are rendered as PNG images
- **Component Tables**: Tables with Component, Location, Purpose, etc. columns are transformed into structured lists
- **YAML Frontmatter**: Removed from all markdown files during processing
- **Regular Tables**: Formatted for better readability in the PDF
- **Page Breaks**: Added between major sections

### Troubleshooting

If you encounter issues:

1. Ensure all prerequisites are installed
2. Check that the `codebase-analysis` directory has the expected structure
3. For Mermaid rendering issues, ensure Node.js is properly installed
4. For PDF generation issues, ensure pandoc and a LaTeX distribution are installed

For PDF formatting issues, you can modify the pandoc parameters in the script to adjust formatting as needed. 