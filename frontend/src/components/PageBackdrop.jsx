/**
 * Same layered backdrop as Landing: navy base + two soft sky-accent blurs.
 * Fixed so it covers the viewport behind scrolling app content.
 */
export default function PageBackdrop() {
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-vg-dark"
      aria-hidden
    >
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-vg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-vg-accent/5 rounded-full blur-3xl" />
    </div>
  );
}
