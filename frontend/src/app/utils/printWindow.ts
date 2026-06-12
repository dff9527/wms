/**
 * Open a new window and print HTML content with print-friendly styling
 * @param title - The title of the print window
 * @param bodyHtml - The HTML content to print (body content only)
 */
export function printHtml(title: string, bodyHtml: string): void {
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    console.error('Failed to open print window - popup blocked?');
    return;
  }

  const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 12px;
          color: #000;
          padding: 20px;
          background-color: #fff;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        
        th, td {
          border: 1px solid #000;
          padding: 8px 12px;
          text-align: left;
        }
        
        th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        
        tr:nth-child(even) {
          background-color: #fafafa;
        }
        
        h1 {
          font-size: 20px;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #000;
        }
        
        h2 {
          font-size: 16px;
          margin-bottom: 15px;
          margin-top: 20px;
          padding-bottom: 5px;
          border-bottom: 1px solid #ccc;
        }
        
        .print-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .print-subtitle {
          font-size: 12px;
          color: #666;
          margin-bottom: 20px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          border-bottom: 1px solid #eee;
        }
        
        .info-label {
          font-weight: bold;
          color: #333;
        }
        
        .info-value {
          color: #666;
        }
        
        .no-data {
          text-align: center;
          padding: 40px;
          color: #666;
          background-color: #f9f9f9;
          border: 1px dashed #ccc;
        }
        
        @media print {
          @page {
            margin: 15mm;
            size: A4;
          }
          
          body {
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          h1, h2 {
            border-bottom-color: #000 !important;
          }
          
          table {
            border-collapse: collapse !important;
          }
          
          th, td {
            border: 1px solid #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .no-data {
            border: 1px dashed #ccc !important;
          }
          
          /* Hide any buttons or interactive elements */
          button, input, select, textarea, [onclick], [role="button"] {
            display: none !important;
          }
          
          /* Remove background colors for print */
          .bg-blue-*, .bg-green-*, .bg-red-*, .bg-yellow-*, .bg-slate-*, .bg-purple-*, .bg-amber-*,
          .bg-slate-100, .bg-slate-50, .bg-blue-50, .bg-green-50, .bg-red-50, .bg-yellow-50, .bg-purple-50, .bg-amber-50 {
            background-color: transparent !important;
          }
          
          .text-blue-*, .text-green-*, .text-red-*, .text-yellow-*, .text-slate-*, .text-purple-*, .text-amber-*,
          .text-blue-600, .text-blue-700, .text-green-600, .text-green-700, .text-slate-600, .text-slate-700, .text-slate-900 {
            color: #000 !important;
          }
          
          .border-blue-*, .border-green-*, .border-red-*, .border-yellow-*, .border-slate-*, .border-purple-*, .border-amber-*,
          .border-blue-200, .border-blue-500, .border-green-200, .border-slate-200, .border-slate-300 {
            border-color: #000 !important;
          }
        }
      </style>
    </head>
    <body>
      ${bodyHtml}
      <script>
        window.onload = function() {
          window.focus();
          window.print();
          // Close window after printing (with user confirmation in some browsers)
          setTimeout(function() {
            window.close();
          }, 1000);
        };
      <\/script>
    </body>
    </html>
  `;

  printWindow.document.write(printHtml);
  printWindow.document.close();
}