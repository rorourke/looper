import {
  ArrowRight,
  Code2,
  Download,
  FolderOpen,
  Laptop,
  LockKeyhole,
  Sparkles
} from "lucide-react";
import looperIcon from "../../electron/build/icon.png";
import {
  looperCreatorUrl,
  looperSourceUrl
} from "../../electron/src/shared/openSource";

const examples = [
  {
    eyebrow: "Plan over time",
    title: "Let one formula become a forecast.",
    source: `loop\nmonth = loop + 1\nrent = $2,400\npaid = rent * month`,
    result: ["$2,400", "$4,800", "$7,200", "$9,600"]
  },
  {
    eyebrow: "Write naturally",
    title: "Give numbers names, then use them.",
    source: `rent = $900\ncar = $600\ngroceries = $450\nbills = rent + car + groceries`,
    result: ["bills", "$1,950"]
  },
  {
    eyebrow: "Build reusable math",
    title: "Turn a calculation into a function.",
    source: `fee(rate, loan) {\n  loan * rate / 12\n}\nmonthly = fee(3%, $2.5M)`,
    result: ["monthly", "$6,250"]
  }
] as const;

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="marketing-site">
      <nav aria-label="Primary" className="site-nav">
        <a aria-label="Looper home" className="brand" href="#top">
          <img alt="" height={34} src={looperIcon.src} width={34} />
          <span>Looper</span>
        </a>
        <div className="nav-actions">
          <a className="nav-source" href={looperSourceUrl} rel="noreferrer" target="_blank">
            <Code2 aria-hidden="true" />
            <span>View source</span>
          </a>
          <a className="button button-small" href="/download">
            Download
          </a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles aria-hidden="true" /> A notebook calculator</p>
          <h1>Think in numbers.<br />See what changes.</h1>
          <p className="hero-intro">
            Looper is a fast, live calculation sheet for exploring numbers over time.
            It is a free, open-source desktop app for Mac and Windows.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/download">
              <Download aria-hidden="true" />
              Download Looper
            </a>
            <a className="button button-secondary" href={looperSourceUrl} rel="noreferrer" target="_blank">
              Explore the code
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
          <p className="hero-note">No account. No subscription. Your sheets stay on your computer.</p>
        </div>

        <div aria-label="Looper calculation example" className="app-preview">
          <div className="preview-titlebar">
            <span className="traffic-lights" aria-hidden="true"><i /><i /><i /></span>
            <strong>Rent Forecast</strong>
            <span className="preview-loop">Loop: 4</span>
          </div>
          <div className="preview-workspace">
            <pre><code><span className="code-accent">loop</span>{`\n`}<span className="code-name">rent</span>{` = `}<span className="code-number">$2,400</span>{`\n`}<span className="code-name">growth</span>{` = `}<span className="code-number">3%</span>{`\n`}<span className="code-name">year</span>{` = loop + 1\n`}<span className="code-name">cost</span>{` = rent * 12 * (1 + growth) ^ loop`}</code></pre>
            <div className="preview-results">
              {[1, 2, 3, 4].map((year, index) => (
                <div className="result-row" key={year}>
                  <span>Year {year}</span>
                  <strong>{["$28,800", "$29,664", "$30,554", "$31,471"][index]}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Product principles" className="principles">
        <article>
          <FolderOpen aria-hidden="true" />
          <div><h2>Files you can see</h2><p>Every sheet is a portable <code>.loop</code> file in a folder you choose.</p></div>
        </article>
        <article>
          <LockKeyhole aria-hidden="true" />
          <div><h2>Private by default</h2><p>Calculations live locally. There are no accounts, payments, or cloud storage.</p></div>
        </article>
        <article>
          <Laptop aria-hidden="true" />
          <div><h2>Made for desktop</h2><p>A focused Electron app for macOS and Windows, with templates included.</p></div>
        </article>
      </section>

      <section className="examples-section">
        <div className="section-heading">
          <p className="eyebrow">Simple language, serious range</p>
          <h2>Write the thought.<br />Looper does the math.</h2>
          <p>Start with familiar arithmetic, then add time, variables, functions, live prices, and reusable templates when you need them.</p>
        </div>
        <div className="example-grid">
          {examples.map((example) => (
            <article className="example-card" key={example.eyebrow}>
              <p className="example-eyebrow">{example.eyebrow}</p>
              <h3>{example.title}</h3>
              <pre><code>{example.source}</code></pre>
              <div className="example-result">
                {example.result.map((value) => <span key={value}>{value}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="download-section">
        <img alt="" height={70} src={looperIcon.src} width={70} />
        <p className="eyebrow">Open source and local-first</p>
        <h2>Make a sheet.<br />Keep the file.</h2>
        <p>Download Looper for Mac or Windows and start with the built-in basics and templates.</p>
        <div className="download-actions">
          <a className="button button-primary" href="/download?platform=macos">Download for Mac</a>
          <a className="button button-secondary" href="/download?platform=windows">Download for Windows</a>
        </div>
        <p className="network-note">Live market-price formulas send only the ticker symbols you request to Looper&apos;s quote service.</p>
      </section>

      <footer className="site-footer">
        <div className="site-footer-content">
          <span>© {currentYear}</span>
          <a href={looperCreatorUrl} rel="noreferrer" target="_blank">
            Ryan Rorke
          </a>
          <span aria-hidden="true">·</span>
          <a href={looperSourceUrl} rel="noreferrer" target="_blank">
            View source
          </a>
        </div>
      </footer>
    </main>
  );
}
