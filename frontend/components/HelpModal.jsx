'use client';
import { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';
import { useAuth } from './AuthProvider';

export default function HelpModal({ onClose }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [copiedCodeIndex, setCopiedCodeIndex] = useState(null);

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

  // Extract structured sections from Markdown content
  const sections = useMemo(() => {
    if (!content) return [];
    const lines = content.split('\n');
    const parsedSections = [];
    let currentSec = { id: 'intro', title: 'Introducción y Generalidades', content: [] };

    for (let line of lines) {
      if (line.startsWith('## ')) {
        if (currentSec.content.length > 0) {
          parsedSections.push(currentSec);
        }
        const title = line.replace('## ', '').trim();
        const id = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        currentSec = { id, title, content: [line] };
      } else {
        currentSec.content.push(line);
      }
    }
    if (currentSec.content.length > 0) {
      parsedSections.push(currentSec);
    }
    return parsedSections;
  }, [content]);

  // Filter content based on selected section and search query
  const filteredContent = useMemo(() => {
    if (!content) return '';
    let targetLines = [];

    if (selectedSection === 'ALL') {
      targetLines = content.split('\n');
    } else {
      const found = sections.find(s => s.id === selectedSection);
      targetLines = found ? found.content : content.split('\n');
    }

    if (!searchQuery.trim()) {
      return targetLines.join('\n');
    }

    // Filter lines containing search query or headers
    const q = searchQuery.toLowerCase();
    const result = [];
    let includeNext = 0;

    for (let i = 0; i < targetLines.length; i++) {
      const line = targetLines[i];
      if (line.startsWith('#') || line.toLowerCase().includes(q)) {
        result.push(line);
        includeNext = 2; // Context lines
      } else if (includeNext > 0) {
        result.push(line);
        includeNext--;
      }
    }

    return result.join('\n');
  }, [content, selectedSection, searchQuery, sections]);

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // Parser helper function with rich visual badges and alerts
  const parseMarkdown = (markdown) => {
    if (!markdown) return '';
    const lines = markdown.split('\n');
    let inList = false;
    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];
    let html = [];
    let codeIndex = 0;

    const highlightSearch = (text) => {
      if (!searchQuery.trim()) return text;
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      return text.replace(regex, '<mark class="help-highlight">$1</mark>');
    };

    const formatText = (text) => {
      let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Roles badges
      escaped = escaped.replace(/`admin`/g, '<span class="role-badge role-badge--admin">admin</span>');
      escaped = escaped.replace(/`supervisor`/g, '<span class="role-badge role-badge--supervisor">supervisor</span>');
      escaped = escaped.replace(/`inspector`/g, '<span class="role-badge role-badge--inspector">inspector</span>');

      // Bold **text**
      let formatted = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code `code`
      formatted = formatted.replace(/`(.*?)`/g, '<code class="help-code">$1</code>');
      // Search highlight
      return highlightSearch(formatted);
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

      // Handle Callouts / Alerts (e.g., > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING])
      if (line.trim().startsWith('>')) {
        const calloutText = line.replace(/^>\s*/, '');
        let alertType = 'info';
        let alertIcon = '💡';
        let alertTitle = 'Nota Técnica';

        if (calloutText.includes('[!TIP]')) {
          alertType = 'tip';
          alertIcon = '✨';
          alertTitle = 'Consejo / Sugerencia';
        } else if (calloutText.includes('[!IMPORTANT]')) {
          alertType = 'important';
          alertIcon = '⚠️';
          alertTitle = 'Importante';
        } else if (calloutText.includes('[!WARNING]')) {
          alertType = 'warning';
          alertIcon = '🚨';
          alertTitle = 'Advertencia';
        }

        const cleanText = calloutText.replace(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/, '').trim();
        html.push(`
          <div class="help-callout help-callout--${alertType}">
            <div class="help-callout-header">
              <span>${alertIcon}</span>
              <strong>${alertTitle}</strong>
            </div>
            <div class="help-callout-body">${formatText(cleanText)}</div>
          </div>
        `);
        continue;
      }

      // Handle Headers
      if (line.startsWith('# ')) {
        html.push(`<h1 class="help-h1">${formatText(line.substring(2))}</h1>`);
      } else if (line.startsWith('## ')) {
        html.push(`<h2 class="help-h2">${formatText(line.substring(3))}</h2>`);
      } else if (line.startsWith('### ')) {
        html.push(`<h3 class="help-h3">${formatText(line.substring(4))}</h3>`);
      } else if (line.startsWith('#### ')) {
        html.push(`<h4 class="help-h4">${formatText(line.substring(5))}</h4>`);
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
      // Handle ordered lists
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
      // Handle code blocks
      else if (line.trim().startsWith('```')) {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        let codeContent = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeContent.push(lines[i]);
          i++;
        }
        const rawCode = codeContent.join('\n');
        const escapedCode = rawCode
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        
        const thisIndex = codeIndex++;
        html.push(`
          <div class="help-code-wrapper">
            <pre class="help-pre"><code>${escapedCode}</code></pre>
          </div>
        `);
      }
      // Handle tables
      else if (line.trim().startsWith('|')) {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
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
        style={{
          width: '92%',
          maxWidth: '1100px',
          height: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#090d16',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden'
        }}
      >
        {/* Header Bar */}
        <div className="help-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📖</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>
                Centro de Ayuda &amp; Manual de Operaciones
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Plataforma Agente Inspector PGP · Guía completa de uso y procedimientos
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, maxWidth: '400px', marginLeft: '2rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Buscar tema, comando, rol o función..."
                style={{
                  width: '100%',
                  padding: '0.5rem 2rem 0.5rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  color: 'white',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <button 
            className="help-modal-close" 
            onClick={onClose} 
            title="Cerrar (Esc)"
            aria-label="Cerrar modal"
            style={{ fontSize: '1.5rem', marginLeft: '1rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            &times;
          </button>
        </div>

        {/* Modal Layout: Sidebar Navigation + Content Area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Left Navigation Sidebar */}
          <div style={{ 
            width: '260px', 
            borderRight: '1px solid rgba(255,255,255,0.1)', 
            backgroundColor: 'rgba(15, 23, 42, 0.3)', 
            padding: '1rem 0.5rem', 
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem'
          }}>
            <div style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              Secciones del Manual
            </div>

            <button
              onClick={() => { setSelectedSection('ALL'); setSearchQuery(''); }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: selectedSection === 'ALL' ? 'rgba(14, 165, 233, 0.2)' : 'transparent',
                color: selectedSection === 'ALL' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: selectedSection === 'ALL' ? 600 : 400,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              🌐 Vista Completa
            </button>

            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => { setSelectedSection(sec.id); setSearchQuery(''); }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem 0.8rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: selectedSection === sec.id ? 'rgba(14, 165, 233, 0.2)' : 'transparent',
                  color: selectedSection === sec.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: selectedSection === sec.id ? 600 : 400,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={sec.title}
              >
                {sec.title}
              </button>
            ))}

            <div style={{ marginTop: 'auto', padding: '1rem 0.8rem 0.5rem 0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                💡 <strong>Atajo:</strong> Presiona <code className="help-code">Esc</code> en cualquier momento para cerrar.
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="help-modal-body" style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: '#0b1120' }}>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '1rem' }}>
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
                dangerouslySetInnerHTML={{ __html: parseMarkdown(filteredContent) }} 
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
