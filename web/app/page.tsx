export default function Home() {
  return (
    <main
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: "64px 20px",
      }}
    >
      <p style={{ fontSize: 13, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
        Shared Cart
      </p>
      <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: "8px 0 16px" }}>
        Cart shared from someone in your family lands here.
      </h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.6 }}>
        This page isn&apos;t meant to be visited directly &mdash; it&apos;s the backend for the
        Shared Cart browser extension. Install the extension, open your Amazon cart, and click{" "}
        <strong>&ldquo;Scan cart &amp; get share link&rdquo;</strong> to generate a link like{" "}
        <code>/cart/[token]</code> that you can send to a family member.
      </p>
    </main>
  );
}
