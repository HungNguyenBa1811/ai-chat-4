
// Completely rewritten markdown processor with separated MathJax and table handling
export function processMarkdown(text: string): string {
  // Step 1: Process tables first (before any other processing)
  let processedText = processMarkdownTables(text);
  
  // Step 2: Process basic markdown formatting (avoid touching math)
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  processedText = processedText.replace(/__(.*?)__/g, '<strong>$1</strong>');
  processedText = processedText.replace(/\*([^*$]+?)\*/g, '<em>$1</em>'); // Avoid $ signs
  processedText = processedText.replace(/~~(.*?)~~/g, '<u>$1</u>');
  
  // Step 3: Convert line breaks to HTML
  processedText = processedText.replace(/\n/g, '<br>');
  
  // Step 4: Clean up any double-escaped LaTeX (leave MathJax content completely untouched)
  processedText = processedText
    .replace(/\\\\(\[|\])/g, '\\$1')
    .replace(/\\\\(\(|\))/g, '\\$1')
    .replace(/\\\\([{}^_])/g, '\\$1')
    .replace(/\\\\(frac|sqrt|sum|int|prod|mu|nu|pi|alpha|beta|gamma|theta|phi|lambda|sigma|delta|omega)/g, '\\$1');
  
  return processedText;
}

// Completely rewritten simple table processor
function processMarkdownTables(text: string): string {
  const lines = text.split('\n');
  let result = '';
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Super simple detection: any line containing | becomes a table row
    if (line.includes('|') && line.trim().length > 0) {
      // Start table processing
      let tableRows = [];
      
      // Collect all consecutive lines with |
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().length > 0) {
        tableRows.push(lines[i]);
        i++;
      }
      
      // Skip any separator rows (lines with mostly - and |)
      const dataRows = tableRows.filter(row => !row.match(/^[\s\|\-:]+$/));
      
      if (dataRows.length > 0) {
        // Create table HTML with dark mode support
        let tableHtml = `<div style="margin: 0 0 8px 0; width: 100%; overflow-x: auto;">
<table class="markdown-table" style="border-collapse: collapse; width: 100%; border-radius: 6px;">`;
        
        // Process each row
        dataRows.forEach((row, rowIndex) => {
          const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
          
          if (cells.length > 0) {
            const isHeader = rowIndex === 0;
            const tag = isHeader ? 'th' : 'td';
            const headerClass = isHeader ? 'header-row' : (rowIndex % 2 === 1 ? 'odd-row' : 'even-row');
            
            tableHtml += `<tr class="${headerClass}">`;
            cells.forEach(cell => {
              tableHtml += `<${tag} class="table-cell ${isHeader ? 'header-cell' : 'data-cell'}">${cell}</${tag}>`;
            });
            tableHtml += `</tr>`;
          }
        });
        
        tableHtml += `</table></div>`;
        result += tableHtml;
      }
      
      i--; // Compensate for the increment at loop end
    } else {
      result += line + '\n';
    }
    
    i++;
  }
  
  return result;
}