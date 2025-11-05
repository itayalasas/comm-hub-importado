import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2, Code, Eye, Split, Wand2 } from 'lucide-react';

interface HTMLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  variables: Array<{ name: string; example: string }>;
}

export const HTMLEditor = ({ value, onChange, onClose, variables }: HTMLEditorProps) => {
  const [localValue, setLocalValue] = useState(value);
  const [viewMode, setViewMode] = useState<'split' | 'code' | 'preview'>('split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const formatHTML = () => {
    try {
      let formatted = localValue;
      let indent = 0;
      const indentSize = 2;

      formatted = formatted.replace(/>\s*</g, '><');

      const lines: string[] = [];
      let currentLine = '';

      for (let i = 0; i < formatted.length; i++) {
        const char = formatted[i];

        if (char === '<') {
          if (currentLine.trim()) {
            lines.push(' '.repeat(indent * indentSize) + currentLine.trim());
            currentLine = '';
          }

          const nextChars = formatted.substring(i, i + 10);
          if (nextChars.startsWith('</')) {
            indent = Math.max(0, indent - 1);
          }

          currentLine += char;
        } else if (char === '>') {
          currentLine += char;

          const tagContent = currentLine;
          if (!tagContent.includes('</') && !tagContent.endsWith('/>') &&
              !tagContent.match(/<(br|hr|img|input|meta|link)/i)) {
            lines.push(' '.repeat(indent * indentSize) + currentLine.trim());
            currentLine = '';
            indent++;
          } else if (tagContent.includes('</')) {
            lines.push(' '.repeat(indent * indentSize) + currentLine.trim());
            currentLine = '';
          } else {
            lines.push(' '.repeat(indent * indentSize) + currentLine.trim());
            currentLine = '';
          }
        } else {
          currentLine += char;
        }
      }

      if (currentLine.trim()) {
        lines.push(' '.repeat(indent * indentSize) + currentLine.trim());
      }

      formatted = lines.join('\n');

      setLocalValue(formatted);
      onChange(formatted);
    } catch (error) {
      console.error('Error formatting HTML:', error);
    }
  };

  const handleSave = () => {
    onChange(localValue);
    onClose();
  };

  const getPreviewHtml = () => {
    let html = localValue;
    variables.forEach((variable) => {
      const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
      html = html.replace(regex, variable.example);
    });
    return html;
  };


  const modalContent = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center space-x-3">
            <Maximize2 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Editor HTML Avanzado</h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={formatHTML}
              className="flex items-center space-x-2 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-sm"
              title="Formatear HTML"
            >
              <Wand2 className="w-4 h-4" />
              <span>Formatear</span>
            </button>

            <div className="flex bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'code'
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Solo código"
              >
                <Code className="w-4 h-4" />
                <span>Código</span>
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'split'
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Vista dividida"
              >
                <Split className="w-4 h-4" />
                <span>Dividir</span>
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Solo vista previa"
              >
                <Eye className="w-4 h-4" />
                <span>Vista Previa</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Cerrar sin guardar"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {(viewMode === 'code' || viewMode === 'split') && (
            <div className={`flex flex-col border-r border-slate-700 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
              <div className="bg-slate-800 px-4 py-2 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center space-x-2">
                  <Code className="w-4 h-4" />
                  <span>Código HTML</span>
                </h3>
              </div>
              <div className="flex-1 overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  className="w-full h-full px-4 py-3 bg-slate-900 text-white font-mono text-sm focus:outline-none resize-none"
                  style={{
                    tabSize: 2,
                    lineHeight: '1.6',
                  }}
                  placeholder="Escribe tu HTML aquí..."
                  spellCheck={false}
                />
              </div>
              <div className="bg-slate-800 px-4 py-2 border-t border-slate-700">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Líneas: {localValue.split('\n').length}</span>
                  <span>Caracteres: {localValue.length}</span>
                </div>
              </div>
            </div>
          )}

          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`flex flex-col bg-white ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
              <div className="bg-slate-800 px-4 py-2 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center space-x-2">
                  <Eye className="w-4 h-4" />
                  <span>Vista Previa</span>
                </h3>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                  style={{ minHeight: '100%' }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800">
          <div className="text-xs text-slate-400">
            Usa <code className="px-1.5 py-0.5 bg-slate-700 rounded text-cyan-400">{`{{variable}}`}</code> para insertar variables dinámicas
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(modalContent, modalRoot);
};
