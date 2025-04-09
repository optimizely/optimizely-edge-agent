#!/bin/bash

# Default values
APP_NAME="Mando"
APP_TITLE="APPLICATION"
OUTPUT_DIR="$(pwd)/codebase-analysis"

# Parse command line arguments
while getopts "a:t:o:" opt; do
  case $opt in
    a) APP_NAME="$OPTARG" ;;
    t) APP_TITLE="$OPTARG" ;;
    o) OUTPUT_DIR="$OPTARG" ;;
    \?) echo "Invalid option -$OPTARG" >&2; exit 1 ;;
  esac
done

# Display configuration
echo "Generating codebase analysis PDF with:"
echo "  Application Name: $APP_NAME"
echo "  Application Title: $APP_TITLE"
echo "  Output Directory: $OUTPUT_DIR"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Create a temp directory for organizing files
mkdir -p temp_md

# Check if mermaid-filter is installed, if not, install it
if ! command -v mmdc &> /dev/null; then
  echo "Installing mermaid-cli for diagram rendering..."
  npm install -g @mermaid-js/mermaid-cli
fi

# Create a temp directory for images
mkdir -p temp_images

# Gather and copy all markdown files from subdirectories
# We'll use a numbering system to maintain the directory order

# 00-executive-summary
mkdir -p temp_md/00-executive-summary
find codebase-analysis/00-executive-summary -name "*.md" -exec cp {} temp_md/00-executive-summary/ \;

# 01-overview
mkdir -p temp_md/01-overview
find codebase-analysis/01-overview -name "*.md" -exec cp {} temp_md/01-overview/ \;

# 02-structure
mkdir -p temp_md/02-structure
find codebase-analysis/02-structure -name "*.md" -exec cp {} temp_md/02-structure/ \;

# 03-frontend and 03-data
mkdir -p temp_md/03-frontend
find codebase-analysis/03-frontend -name "*.md" -exec cp {} temp_md/03-frontend/ \;
mkdir -p temp_md/03-data
find codebase-analysis/03-data -name "*.md" -exec cp {} temp_md/03-data/ \;

# 04-backend, 04-routing, 04-performance
mkdir -p temp_md/04-backend
find codebase-analysis/04-backend -name "*.md" -exec cp {} temp_md/04-backend/ \;
mkdir -p temp_md/04-routing
find codebase-analysis/04-routing -name "*.md" -exec cp {} temp_md/04-routing/ \;
mkdir -p temp_md/04-performance
find codebase-analysis/04-performance -name "*.md" -exec cp {} temp_md/04-performance/ \;

# 05-ui and 05-serverless
mkdir -p temp_md/05-ui
find codebase-analysis/05-ui -name "*.md" -exec cp {} temp_md/05-ui/ \;
mkdir -p temp_md/05-serverless
find codebase-analysis/05-serverless -name "*.md" -exec cp {} temp_md/05-serverless/ \;

# 06-data
mkdir -p temp_md/06-data
find codebase-analysis/06-data -name "*.md" -exec cp {} temp_md/06-data/ \;

# 07-security
mkdir -p temp_md/07-security
find codebase-analysis/07-security -name "*.md" -exec cp {} temp_md/07-security/ \;

# 08-patterns
mkdir -p temp_md/08-patterns
find codebase-analysis/08-patterns -name "*.md" -exec cp {} temp_md/08-patterns/ \;

# 09-quality
mkdir -p temp_md/09-quality
find codebase-analysis/09-quality -name "*.md" -exec cp {} temp_md/09-quality/ \;

# 10-cross-cutting
mkdir -p temp_md/10-cross-cutting
find codebase-analysis/10-cross-cutting -name "*.md" -exec cp {} temp_md/10-cross-cutting/ \;

# 11-recommendations
mkdir -p temp_md/11-recommendations
find codebase-analysis/11-recommendations -name "*.md" -exec cp {} temp_md/11-recommendations/ \;

# Remove YAML frontmatter from all markdown files
for file in $(find temp_md -name "*.md"); do
  # Create a temporary file
  temp_file="${file}.tmp"
  
  # Remove YAML frontmatter (content between triple dashes)
  awk '
    BEGIN { remove = 0; start = 0; }
    /^---$/ { 
      if (start == 0) { 
        start = 1; 
        remove = 1; 
        next; 
      } else if (remove == 1) { 
        remove = 0; 
        next; 
      }
    }
    { if (remove == 0) print $0; }
  ' "$file" > "$temp_file"
  
  # Replace the original file with the modified one
  mv "$temp_file" "$file"
done

# Process Mermaid diagrams: find ```mermaid blocks, render them to PNGs, and replace blocks with image links
echo "Processing Mermaid diagrams..."
for file in $(find temp_md -name "*.md"); do
  if grep -q '```mermaid' "$file"; then
    # echo "Processing Mermaid diagrams in $file..." # Optional: verbose logging
    processed_file="${file}.processed"
    > "$processed_file" # Clear/create the processed file
    in_mermaid_block=false
    mermaid_content=""
    diagram_index=0
    # Use ## as delimiter to handle file names with spaces potentially (though unlikely here)
    file_base=$(basename "$file" .md)

    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" == \`\`\`mermaid* ]]; then
        in_mermaid_block=true
        mermaid_content=""
        diagram_index=$((diagram_index + 1))
        # Don't write the opening ```mermaid line to processed file
      elif [[ "$line" == \`\`\` ]] && $in_mermaid_block; then
        in_mermaid_block=false
        # Process the collected mermaid content
        temp_mmd_file="temp_md/temp_diagram_${file_base}_${diagram_index}.mmd" # Unique temp file
        # Need to ensure mermaid_content ends with a newline for mmdc
        printf "%s\\n" "$mermaid_content" > "$temp_mmd_file"
        
        # Generate unique, filesystem-safe filename base
        safe_file_base=$(echo "$file_base" | sed 's/[^a-zA-Z0-9_-]/-/g')
        png_filename="${safe_file_base}_diagram_${diagram_index}.png"
        png_filepath="temp_images/$png_filename"

        echo "  Generating $png_filepath from $file..."
        # Use mmdc to render. Add error checking.
        if mmdc -i "$temp_mmd_file" -o "$png_filepath" -w 1024 -b transparent; then
           # Add image link to processed file. Path is relative to final MD file in root.
           echo "![]($png_filepath)" >> "$processed_file"
        else
           echo "  Warning: Failed to render Mermaid diagram ${diagram_index} in ${file}." >&2
           # Fallback: include the original code block
           echo "\`\`\`mermaid" >> "$processed_file"
           printf "%s\\n" "$mermaid_content" >> "$processed_file"
           echo "\`\`\`" >> "$processed_file"
           echo "  Included original Mermaid code block as fallback." >&2
        fi
        rm "$temp_mmd_file" # Clean up temp .mmd file
      elif $in_mermaid_block; then
        # Append line to mermaid_content buffer
        mermaid_content+="$line"$'\n' 
      else
        # Write non-mermaid lines directly to processed file
        echo "$line" >> "$processed_file" 
      fi
    done < "$file"

    # Replace original file with processed version
    mv "$processed_file" "$file"
  fi
done
echo "Finished processing Mermaid diagrams."

# Process markdown tables to improve PDF formatting - converting tables to structured lists
echo "Processing component inventory tables..."
for file in $(find temp_md -name "*.md"); do
  # Only process files that might contain component tables
  if grep -q -E "Components.*\n+.*\|" "$file"; then
    temp_file="${file}.tmp"
    
    # Apply a more direct approach: completely transform these tables
    # First, completely replace all component table headers to remove Location column
    sed -i -E 's/\| +Component +\| +Location +\| +Purpose +\| +Complexity +\| +Reusability +\|/| Component | Purpose | Complexity | Reusability |/g' "$file"
    
    # Then replace the separator line to match our new column count
    sed -i -E 's/\|-+\|-+\|-+\|-+\|-+\|/|----|----|----|----|\n/g' "$file"
    
    # Now remove the Location column data from each row
    awk '
    BEGIN { in_component_table = 0; } 
    
    # Detect start of a component table
    /\| Component \| Purpose \| Complexity \| Reusability \|/ { 
      in_component_table = 1;
      print;
      next;
    }

    # Process table rows when in a component table
    in_component_table && /^\|/ {
      # Match the component name, location, purpose, complexity, reusability
      if (match($0, /\| *([^|]+) *\| *([^|]+) *\| *([^|]+) *\| *([^|]+) *\| *([^|]+) *\|/, parts)) {
        # Rebuild the line without the location column
        printf("| %s | %s | %s | %s |\n", parts[1], parts[3], parts[4], parts[5]);
        next;
      }
    }
    
    # If we hit a non-table line, we are no longer in a component table
    in_component_table && !/^\|/ { in_component_table = 0; }
    
    # Print all other lines as is
    { print; }
    ' "$file" > "$temp_file"
    
    # Replace the original with our processed version
    mv "$temp_file" "$file"
  fi
done
echo "Finished removing location columns from component tables."

# Then continue with the rest of the conversion to structured lists
echo "Converting component tables to structured lists..."
for file in $(find temp_md -name "*.md"); do
  # Only process files that might contain component tables
  if grep -q -E "Components.*\n+.*\|" "$file"; then
    temp_file="${file}.tmp"
    
    # Process the file, converting component tables to structured lists
    awk '
    BEGIN {
      in_table = 0
      table_data = ""
      header_line = ""
      is_component_table = 0
      component_section_title = ""
    }
    
    # Detect component section headings
    /Components/ {
      component_section_title = $0
    }
    
    # Table start detection
    /^\s*\|/ && !in_table {
      in_table = 1
      header_line = $0
      
      # Check if this is a component inventory table by examining the header
      if (header_line ~ /Component.*Purpose/ || header_line ~ /Reusability/) {
        is_component_table = 1
        table_data = header_line "\n"
        # Capture the section title if it exists
        if (component_section_title != "") {
          section_title = component_section_title
          component_section_title = ""
        }
        next
      } else {
        # Not a component inventory table, just print it as is
        is_component_table = 0
        print
        next
      }
    }
    
    # Add line to table data if we are in a table
    /^\s*\|/ && in_table {
      if (is_component_table) {
        table_data = table_data $0 "\n"
        next
      } else {
        print
        next
      }
    }
    
    # End of table detection
    !/^\s*\|/ && in_table {
      in_table = 0
      
      # Process the component table if we identified one
      if (is_component_table) {
        is_component_table = 0
        
        # Split the table data into lines
        n = split(table_data, table_lines, "\n")
        
        # Print a horizontal rule before the component list
        print "---"
        print ""
        
        # Skip the separator line (second line)
        start_index = 3
        if (n < 3) start_index = 2  # Safeguard
        
        # Process each component row
        for (i = start_index; i <= n; i++) {
          if (table_lines[i] == "") continue
          
          # Split the row into columns - now with 4 columns instead of 5
          gsub(/^\s*\|\s*/, "", table_lines[i])  # Remove leading pipe and space
          gsub(/\s*\|\s*$/, "", table_lines[i])  # Remove trailing space and pipe
          split(table_lines[i], columns, /\s*\|\s*/)
          
          # Extract component data - column indexes shifted since Location is removed
          component = columns[1]
          purpose = columns[2]
          complexity = columns[3]
          reusability = columns[4]
          
          # Format as a structured entry
          print "### " component
          print ""
          print "- **Purpose:** " purpose
          print "- **Complexity:** " complexity
          print "- **Reusability:** " reusability
          print ""
        }
        
        # Print a horizontal rule after the component list
        print "---"
        print ""
      }
      
      # Print the current line
      print
      next
    }
    
    # Print any line that is not part of a table
    { print }
    
    END {
      # Handle case where file ends with a table
      if (in_table && is_component_table) {
        # Process the component table (simplified for brevity)
        print "---"  # End marker
      }
    }
    ' "$file" > "$temp_file"
    
    # Only replace the original file if the temp file is not empty
    if [[ -s "$temp_file" ]]; then
      echo "  Converted component tables to structured lists in $(basename "$file")"
      mv "$temp_file" "$file"
    else
      echo "  Warning: Empty output when processing ${file}, keeping original file."
      rm -f "$temp_file"
    fi
  fi
done
echo "Finished processing component tables."

# Process regular (non-component) markdown tables
echo "Processing other tables..."
for file in $(find temp_md -name "*.md"); do
  # Skip if no tables remain in the file
  if ! grep -q '|' "$file"; then
    continue
  fi
  
  # Process regular tables (non-component inventory tables)
  temp_file="${file}.tmp"
  
  # Process the file, converting normal tables to fixed-width text
  awk '
  BEGIN {
    in_table = 0
    table_data = ""
    is_component_table = 0
  }
  
  # Skip component tables
  /Component.*Location.*Purpose/ || /Reusability/ {
    # Mark possible component table header
    is_potential_component = 1
  }
  
  # Table start detection
  /^\s*\|/ && !in_table {
    in_table = 1
    header_line = $0
    
    # Check if this looks like a component table - if so, print as is
    if (is_potential_component) {
      is_component_table = 1
      is_potential_component = 0
      print
      next
    } else {
      # Regular table - collect for processing
      is_component_table = 0
      table_data = $0 "\n"
      next
    }
  }
  
  # Reset component table flag when not in a table
  !/^\s*\|/ && !in_table {
    is_potential_component = 0
  }
  
  # Add line to table data if we are in a table
  /^\s*\|/ && in_table {
    if (is_component_table) {
      # Print component table lines as-is
      print
      next
    } else {
      # Collect regular table data
      table_data = table_data $0 "\n"
      next
    }
  }
  
  # End of table detection
  !/^\s*\|/ && in_table {
    in_table = 0
    
    if (!is_component_table) {
      # Process regular table
      n = split(table_data, table_lines, "\n")
      
      # Simple approach - just add spacing to table cells
      printf("\n")  # Start with a blank line
      
      for (i = 1; i <= n; i++) {
        if (table_lines[i] == "") continue
        
        # Add spacing to make cells more readable
        line = table_lines[i]
        gsub(/\|/, " | ", line)
        gsub(/^\s*\|\s*/, "| ", line)  # Fix start
        gsub(/\s*\|\s*$/, " |", line)  # Fix end
        
        printf("%s\n", line)
      }
      
      printf("\n")  # End with a blank line
    }
    
    # Print the current line
    print
    next
  }
  
  # Print any line that is not part of a table
  { print }
  
  END {
    # Handle case where file ends with a table
    if (in_table && !is_component_table) {
      # Process the regular table
      printf("\n")  # End with a blank line
    }
  }
  ' "$file" > "$temp_file"
  
  # Only replace the original file if the temp file is not empty
  if [[ -s "$temp_file" ]]; then
    echo "  Formatted regular tables in $(basename "$file")"
    mv "$temp_file" "$file"
  else
    echo "  Warning: Empty output when processing ${file}, keeping original file."
    rm -f "$temp_file"
  fi
done
echo "Finished processing tables."

# Generate a table of contents markdown file with a nice header
cat > temp_md/toc.md << EOF
<div style="text-align: center; padding: 20px;">
<h1 style="font-size: 28px; color: #2c3e50;"> ${APP_TITLE}</h1>
<h2 style="font-size: 22px; color: #3498db; margin-top: 10px;">Comprehensive Codebase Analysis</h2>
<p style="font-style: italic; color: #7f8c8d; margin-top: 10px;">A technical evaluation of architecture, design patterns, and implementation</p>
<hr style="width: 50%; margin: 20px auto; border: 1px solid #ecf0f1;">
</div>

EOF

# Define the directories in order - restore this critical part
ordered_dirs=(
  "00-executive-summary"
  "01-overview"
  "02-structure"
  "03-frontend"
  "03-data"
  "04-backend"
  "04-routing"
  "04-performance"
  "05-ui"
  "05-serverless"
  "06-data"
  "07-security"
  "08-patterns"
  "09-quality"
  "10-cross-cutting"
  "11-recommendations"
)

# Create output filenames based on app name
MD_OUTPUT_FILE="${OUTPUT_DIR}/${APP_NAME,,}-codebase-analysis.md"
PDF_OUTPUT_FILE="${OUTPUT_DIR}/${APP_NAME}-Codebase-Analysis.pdf"

# Create a combined markdown file (without adding our own TOC)
cat temp_md/toc.md > "$MD_OUTPUT_FILE"

# Flag to track if we have added any section yet (to manage page breaks)
section_added_flag=false

# Append all files in order according to the same order as TOC
for dir_name in "${ordered_dirs[@]}"; do
  full_path="temp_md/${dir_name}"
  
  # Check if the directory exists AND contains any .md files before adding the section
  if [[ -d "$full_path" ]] && [[ -n "$(find "$full_path" -name "*.md" -print -quit)" ]]; then
    dir_title=$(echo "$dir_name" | sed 's/^[0-9]*-//')
    
    # Add page break before section, but only if at least one section has already been added
    if $section_added_flag; then
        printf "\n\n<div style=\"page-break-after: always;\"></div>\n\n" >> "$MD_OUTPUT_FILE"
    fi
    
    # Special formatting for executive summary section
    if [[ "$dir_name" == "00-executive-summary" ]]; then
      printf "\n\n# EXECUTIVE SUMMARY\n\n" >> "$MD_OUTPUT_FILE"
      printf "<div style=\"background-color: #f8f9fa; padding: 15px; border-left: 5px solid #3498db; margin-bottom: 20px;\">\n" >> "$MD_OUTPUT_FILE"
      printf "<p style=\"font-style: italic;\">This executive summary provides a concise overview of the ${APP_NAME} codebase analysis. It highlights key findings, architectural patterns, strengths, weaknesses, and critical recommendations.</p>\n" >> "$MD_OUTPUT_FILE"
      printf "</div>\n\n" >> "$MD_OUTPUT_FILE"
    else
      # Regular section header
      printf "\n\n# %s\n\n" "${dir_title^}" >> "$MD_OUTPUT_FILE"
    fi
    
    # Mark that we have now added at least one section
    section_added_flag=true
    
    files=$(find "$full_path" -name "*.md" | sort)
    first_file_in_section=true # Flag to manage spacing between files within a section
    for file in $files; do
      # Add separator before the next file content, except for the first file in this section
      if ! $first_file_in_section; then
        printf "\n\n" >> "$MD_OUTPUT_FILE"
      fi
      first_file_in_section=false # Update flag
      
      # Extract file title for subsection header
      file_title=$(grep -m 1 "^# " "$file" | sed 's/^# //')
      if [ -z "$file_title" ]; then
        file_name=$(basename "$file")
        file_title=$(echo "$file_name" | sed 's/\.md$//' | sed 's/-/ /g' | sed 's/_/ /g')
      fi
      
      # Special case for executive summary files - don't add subsection header
      if [[ "$dir_name" != "00-executive-summary" ]]; then
        printf "## %s\n\n" "$file_title" >> "$MD_OUTPUT_FILE"
      fi
      
      # Remove any log-like entries or debug information, and the file's own H1, then add content
      cat "$file" | sed '/^\[DEBUG\]/d' | sed '/^\[LOG\]/d' | sed '/^# /d' >> "$MD_OUTPUT_FILE"
    done
  fi # End of check for non-empty directory
done

# After all content is added, do a final cleanup to fix any remaining formatting issues
sed -i 's/\\n\\n---\\n\\n/\n\n---\n\n/g' "$MD_OUTPUT_FILE"
sed -i 's/\\n\\n/\n\n/g' "$MD_OUTPUT_FILE"

# Convert to PDF using pandoc with better TOC formatting
pandoc "$MD_OUTPUT_FILE" -o "$PDF_OUTPUT_FILE" \
  --toc --toc-depth=1 \
  --highlight-style=tango \
  --pdf-engine=xelatex \
  -V geometry:"margin=0.75in,paperwidth=8.5in,paperheight=11in" \
  -V mainfont="DejaVu Sans" \
  -V monofont="DejaVu Sans Mono" \
  -V toc-title:"Contents" \
  -V documentclass=report \
  -V classoption=oneside \
  -V toc-own-page=true \
  --metadata title="${APP_NAME} Application Codebase Analysis" \
  --metadata author="Technical Assessment Team" \
  --metadata date="$(date +"%B %Y")"

# Clean up
rm -rf temp_md temp_images
echo "PDF created: $PDF_OUTPUT_FILE"
echo "Markdown created: $MD_OUTPUT_FILE"
echo "Mermaid diagrams have been rendered as images in the PDF."

# Show usage information
echo ""
echo "Usage: $0 [-a APP_NAME] [-t APP_TITLE] [-o OUTPUT_DIR]"
echo "  -a: Application name (default: \"$APP_NAME\")"
echo "  -t: Application title (default: \"$APP_TITLE\")"
echo "  -o: Output directory (default: \"$OUTPUT_DIR\")"