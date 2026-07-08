import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "src", "App.tsx");
const cssPath = path.join(root, "styles.css");
const outputPath = path.join(root, "TrailwiseRecordingPrototype.tsx");

let app = fs.readFileSync(appPath, "utf8");
const css = fs
  .readFileSync(cssPath, "utf8")
  .replaceAll("`", "\\`")
  .replaceAll("${", "\\${");

const styleBlock = `const trailwisePrototypeStyles = String.raw\`${css}\`;

function TrailwisePrototypeStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const styleId = "trailwise-recording-prototype-styles";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    style.textContent = trailwisePrototypeStyles;
    return undefined;
  }, []);

  return null;
}

`;

app = app.replace(
  "const icon18 = { size: 18, strokeWidth: 1.75 };",
  `${styleBlock}const icon18 = { size: 18, strokeWidth: 1.75 };`,
);

app = app.replace(
  "export default function App() {",
  `export default function TrailwiseRecordingPrototype({
  logoSrc = "/assets/trailwise-logo-exact.svg",
}: {
  logoSrc?: string;
}) {`,
);

app = app.replace('src="/assets/trailwise-logo-exact.svg"', "src={logoSrc}");

app = app.replace(
  'return (\n    <main className="screen-shell"',
  `return (
    <>
      <TrailwisePrototypeStyles />
      <main className="screen-shell"`,
);

app = app.replace(
  "    </main>\n  );\n}\n",
  `      </main>
    </>
  );
}
`,
);

fs.writeFileSync(outputPath, app);
console.log(outputPath);
