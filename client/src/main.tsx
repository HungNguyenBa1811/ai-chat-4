import { createRoot } from "react-dom/client";
import { MathJaxContext } from "better-react-mathjax";
import App from "./App";
import "./index.css";

const mathJaxConfig = {
  loader: { load: ["[tex]/html"] },
  tex: {
    packages: { "[+]": ["html"] },
    inlineMath: [["$", "$"], ["\\(", "\\)"]],
    displayMath: [["$$", "$$"], ["\\[", "\\]"]]
  }
};

createRoot(document.getElementById("root")!).render(
  <MathJaxContext config={mathJaxConfig}>
    <App />
  </MathJaxContext>
);
