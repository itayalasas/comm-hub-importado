interface HtmlPreviewFrameProps {
  html: string;
  title?: string;
  className?: string;
  minHeight?: number | string;
}

// Muestra el HTML de un template aislado del panel. El iframe con `sandbox`
// no ejecuta scripts ni accede a la sesión, y los estilos del template no
// afectan al resto de la página.
export const HtmlPreviewFrame = ({
  html,
  title = 'Vista previa del template',
  className = '',
  minHeight = 400,
}: HtmlPreviewFrameProps) => (
  <iframe
    title={title}
    srcDoc={html}
    sandbox="allow-popups allow-popups-to-escape-sandbox"
    referrerPolicy="no-referrer"
    className={`block w-full border-0 bg-white ${className}`}
    style={{ minHeight }}
  />
);
