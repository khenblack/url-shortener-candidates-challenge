import type { RecentLink } from "@url-shortener/engine";
import { Form } from "react-router";
import { Button } from "../../components/ui/button/button";
import { Card } from "../../components/ui/card/card";
import { InlineError } from "../../components/ui/inline-error/inline-error";
import { TextInput } from "../../components/ui/text-input/text-input";

type ShortenerViewProps = {
  baseUrl: string;
  shortenedUrl?: string;
  error?: string;
  recentLinks?: RecentLink[];
  recentLinksError?: string;
};

export function ShortenerView({
  baseUrl,
  shortenedUrl,
  error,
  recentLinks = [],
  recentLinksError,
}: ShortenerViewProps) {
  return (
    <main className="page-shell">
      <div className="shortener-layout">
        <Card>
          <h1 className="page-title">URL Shortener</h1>

          <Form method="post" className="shortener-form">
            <TextInput
              type="text"
              name="url"
              placeholder="Enter your URL here..."
              required
            />

            <div className="form-details">
              <Button type="submit">SHORTEN IT</Button>
              <p className="url-hint">
                Your shortened URL will start with {baseUrl}
              </p>
            </div>
          </Form>

          {shortenedUrl && (
            <Card variant="result">
              <p className="result-label">Your shortened URL:</p>
              <a
                href={shortenedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="result-link"
              >
                {shortenedUrl}
              </a>
            </Card>
          )}

          {error && <InlineError message={error} />}
        </Card>
        <Card className="history-card">
          <section aria-labelledby="recent-links-title">
            <h2 id="recent-links-title">Your Recent Links</h2>
            {recentLinksError && <InlineError message={recentLinksError} />}
            {recentLinks.length === 0 && !recentLinksError && (
              <p>Links you create in this browser will appear here.</p>
            )}
            {recentLinks.map((link) => (
              <Card variant="result" key={link.code}>
                <a
                  className="result-link"
                  href={`/s/${encodeURIComponent(link.code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {baseUrl}
                  {link.code}
                </a>
                <p style={{ overflowWrap: "anywhere" }}>{link.destination}</p>
                <p>
                  {link.clickCount} {link.clickCount === 1 ? "click" : "clicks"}
                </p>
              </Card>
            ))}
          </section>
        </Card>
      </div>
    </main>
  );
}
