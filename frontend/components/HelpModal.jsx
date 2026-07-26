'use client';
import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useAuth } from './AuthProvider';

export default function HelpModal({ onClose }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');

  useEffect(() => {
    const fetchManual = async () => {
      try {
        setLoading(true);
        const data = await apiService.getManual(token);
        setContent(data.content || '');
      } catch (err) {
        console.error('Error fetching manual:', err);
        setError('No se pudo cargar el manual de uso.');
      } finally {
        setLoading(false);
      }
    };

    fetchManual();
  }, [token]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Parser helper function
  const parseMarkdown = (markdown) => {
    if (!markdown) return '';
    const lines = markdown.split('\n');
    let inList = false;
    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];
    let html = [];

    const formatText = (text) => {
      // Escape HTML
      let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      
      // Bold **text**
      let formatted = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code `code`
      formatted = formatted.replace(/`(.*?)`/g, '<code class="help-code">$1</code>');
      return formatted;
    };

    const renderTable = (headers, rows) => {
      let th = headers.map(h => `<th class="help-th">${formatText(h)}</th>`).join('');
      let tr = rows.map(row => {
        let tds = row.map(cell => `<td class="help-td">${formatText(cell)}</td>`).join('');
        return `<tr class="help-tr">${tds}</tr>`;
      }).join('');
      return `<div class="help-table-container"><table class="help-table"><thead class="help-thead"><tr>${th}</tr></thead><tbody class="help-tbody">${tr}</tbody></table></div>`;
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Handle empty lines
      if (line.trim() === '') {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        if (inTable) {
          html.push(renderTable(tableHeaders, tableRows));
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
        continue;
      }

      // Handle Headers
      if (line.startsWith('# ')) {
        html.push(`<h1 class="help-h1">${formatText(line.substring(2))}</h1>`);
      } else if (line.startsWith('## ')) {
        html.push(`<h2 class="help-h2">${formatText(line.substring(3))}</h2>`);
      } else if (line.startsWith('### ')) {
        html.push(`<h3 class="help-h3">${formatText(line.substring(4))}</h3>`);
      } else if (line.startsWith('---')) {
        html.push('<hr class="help-hr" />');
      }
      // Handle bullet points
      else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        if (!inList) {
          html.push('<ul class="help-ul">');
          inList = true;
        }
        const content = line.trim().substring(2);
        html.push(`<li class="help-li">${formatText(content)}</li>`);
      }
      // Handle ordered lists/numbered lists
      else if (/^\d+\.\s/.test(line.trim())) {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        const content = line.trim().replace(/^\d+\.\s/, '');
        const numMatch = line.trim().match(/^\d+/);
        const num = numMatch ? numMatch[0] : '1';
        html.push(`<div class="help-ol-item"><span class="help-ol-num">${num}.</span> ${formatText(content)}</div>`);
      }
      // Handle code blocks or ASCII diagrams
      else if (line.trim().startsWith('```')) {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        let codeContent = [];
        i++; // Skip the open ```
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeContent.push(lines[i]);
          i++;
        }
        // Escape HTML inside code content
        const escapedCode = codeContent.join('\n')
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        html.push(`<pre class="help-pre"><code>${escapedCode}</code></pre>`);
      }
      // Handle tables
      else if (line.trim().startsWith('|')) {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        // Check if it's separator line (e.g. |---|---|)
        if (line.includes('---')) {
          continue;
        }
        const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
      }
      // General paragraph
      else {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        if (inTable) {
          html.push(renderTable(tableHeaders, tableRows));
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
        html.push(`<p class="help-p">${formatText(line)}</p>`);
      }
    }

    // Close open lists/tables
    if (inList) html.push('</ul>');
    if (inTable) html.push(renderTable(tableHeaders, tableRows));

    return html.join('');
  };

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div 
        className="help-modal glass-panel" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="help-modal-header">
          <h3 className="help-modal-title">
            <span>📖</span> Manual de Uso &amp; Guía del Sistema
          </h3>
          <button 
            className="help-modal-close" 
            onClick={onClose} 
            title="Cerrar (Esc)"
            aria-label="Cerrar modal"
          >
            &times;
          </button>
        </div>

        <div className="help-modal-body">
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '1rem' }}>
              <div className="spinner" style={{ width: '36px', height: '36px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Cargando manual del sistema...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
              <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>⚠️ {error}</p>
              <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
            </div>
          )}

          {!loading && !error && (
            <div 
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} 
            />
          )}
        </div>
      </div>
    </div>
  );
}
