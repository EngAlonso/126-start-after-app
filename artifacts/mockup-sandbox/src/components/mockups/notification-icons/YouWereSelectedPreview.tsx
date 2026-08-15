const selectedTechnicianImage =
  "/__mockup/images/selected-technician-reference.png";

export function YouWereSelectedPreview() {
  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "32px",
        background: "#f7f9fb",
        color: "#1a1a1a",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(100%, 520px)",
          margin: "0 auto",
          overflow: "hidden",
          border: "1px solid #e1e5ea",
          borderRadius: "18px",
          background: "#ffffff",
          boxShadow: "0 16px 40px rgba(26, 26, 26, 0.08)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: "1px solid #edf0f3",
          }}
        >
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700 }}>
              Notifications
            </div>
            <div style={{ marginTop: "4px", color: "#737373", fontSize: "12px" }}>
              In-app icon preview
            </div>
          </div>
          <span
            style={{
              padding: "6px 10px",
              borderRadius: "999px",
              background: "#fff5e8",
              color: "#b76a12",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            Proposed
          </span>
        </header>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            minHeight: "104px",
            padding: "18px 22px",
            direction: "rtl",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "42px",
              height: "42px",
              flex: "0 0 42px",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={selectedTechnicianImage}
              alt="Technician illustration for the You Were Selected notification"
              style={{
                display: "block",
                width: "48px",
                height: "48px",
                objectFit: "contain",
              }}
            />
          </div>

          <div style={{ minWidth: 0, flex: 1, textAlign: "right" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                color: "#737373",
                fontSize: "11px",
              }}
            >
              <span>منذ دقيقتين</span>
              <span
                aria-label="Unread notification"
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#e9b73a",
                }}
              />
            </div>
            <div
              style={{
                marginTop: "5px",
                fontSize: "15px",
                fontWeight: 700,
                lineHeight: 1.35,
              }}
            >
              تم اختيارك
            </div>
            <div
              style={{
                marginTop: "3px",
                overflow: "hidden",
                color: "#737373",
                fontSize: "12px",
                lineHeight: 1.4,
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              تم اختيارك لتنفيذ طلب الخدمة
            </div>
          </div>
        </div>

        <footer
          style={{
            padding: "12px 22px 16px",
            borderTop: "1px solid #edf0f3",
            color: "#737373",
            fontSize: "11px",
            textAlign: "center",
          }}
        >
          Borderless artwork · matched to the existing 48px message/rating scale
        </footer>
      </section>
    </main>
  );
}