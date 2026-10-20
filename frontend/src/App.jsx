import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000/api";
const CONTACTS_URL = `${API_BASE}/contacts`;
const IMPORT_URL = `${API_BASE}/import/connections`;
const REFRESH_URL = `${API_BASE}/contacts/refresh`;
const UPDATE_STAGE_URL = `${API_BASE}/contacts/update_stage`;
const GENERATE_URL = `${API_BASE}/engagements/generate`;
const PIPELINE_STAGES = ["Identified", "Warming", "Messaged", "Replied", "Warm"];
const ICEBREAKER_STYLES = ["Insight-Led", "Executive", "Casual"];

const COLUMNS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "current_company", label: "Company" },
  { key: "current_title", label: "Title" },
  { key: "pipeline_stage", label: "Pipeline" },
  { key: "ai_score_total", label: "Score" },
  { key: "profile_url", label: "LinkedIn" },
];

const styles = {
  page: {
    minHeight: "100vh",
    margin: 0,
    padding: "32px 40px 48px",
    fontFamily: "Segoe UI, system-ui, sans-serif",
    background: "#0b1220",
    color: "#e2e8f0",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 24,
    marginBottom: 28,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#7dd3fc",
    fontWeight: 600,
  },
  title: {
    margin: "8px 0 0",
    fontSize: 32,
    fontWeight: 650,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#94a3b8",
    fontSize: 14,
  },
  uploadButton: {
    appearance: "none",
    border: "1px solid #38bdf8",
    background: "#0ea5e9",
    color: "#0b1220",
    fontWeight: 650,
    fontSize: 14,
    padding: "10px 16px",
    borderRadius: 8,
    cursor: "pointer",
  },
  uploadButtonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  hiddenInput: {
    display: "none",
  },
  banner: {
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
  },
  bannerOk: {
    background: "#052e16",
    border: "1px solid #166534",
    color: "#86efac",
  },
  bannerError: {
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    color: "#fecaca",
  },
  panel: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 12,
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #1f2937",
  },
  panelTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
  },
  count: {
    color: "#94a3b8",
    fontSize: 13,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    color: "#94a3b8",
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    background: "#0f172a",
    borderBottom: "1px solid #1f2937",
  },
  td: {
    padding: "12px 16px",
    borderBottom: "1px solid #1f2937",
    color: "#e2e8f0",
    verticalAlign: "top",
  },
  empty: {
    padding: "40px 20px",
    textAlign: "center",
    color: "#94a3b8",
  },
  link: {
    color: "#7dd3fc",
    textDecoration: "none",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.62)",
    zIndex: 40,
  },
  drawer: {
    position: "fixed",
    top: 0,
    right: 0,
    height: "100vh",
    width: "min(460px, 100vw)",
    background: "#0f172a",
    borderLeft: "1px solid #1e293b",
    boxShadow: "-16px 0 40px rgba(0, 0, 0, 0.35)",
    zIndex: 50,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  drawerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "24px 24px 16px",
    borderBottom: "1px solid #1e293b",
  },
  drawerName: {
    margin: "6px 0 0",
    fontSize: 22,
    fontWeight: 650,
    letterSpacing: "-0.03em",
  },
  closeButton: {
    appearance: "none",
    border: "1px solid #334155",
    background: "transparent",
    color: "#cbd5e1",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 13,
  },
  drawerBody: {
    padding: 24,
    overflowY: "auto",
    flex: 1,
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 20,
  },
  metaLabel: {
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: 650,
  },
  metaValue: {
    margin: "4px 0 0",
    fontSize: 14,
    color: "#e2e8f0",
  },
  fieldLabel: {
    display: "block",
    marginBottom: 8,
    fontSize: 13,
    fontWeight: 650,
    color: "#cbd5e1",
  },
  textarea: {
    width: "100%",
    minHeight: 220,
    boxSizing: "border-box",
    resize: "vertical",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#020617",
    color: "#e2e8f0",
    fontFamily: "inherit",
    fontSize: 14,
    lineHeight: 1.5,
  },
  refreshButton: {
    appearance: "none",
    marginTop: 16,
    width: "100%",
    border: "1px solid #38bdf8",
    background: "#0ea5e9",
    color: "#0b1220",
    fontWeight: 700,
    fontSize: 14,
    padding: "12px 16px",
    borderRadius: 10,
    cursor: "pointer",
  },
  panelError: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 8,
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    color: "#fecaca",
    fontSize: 13,
  },
  stageBlock: {
    marginBottom: 22,
  },
  stageRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  stageButton: {
    appearance: "none",
    border: "1px solid #334155",
    background: "#020617",
    color: "#cbd5e1",
    fontWeight: 650,
    fontSize: 12,
    padding: "8px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  stageButtonActive: {
    border: "1px solid #38bdf8",
    background: "#0ea5e9",
    color: "#0b1220",
  },
  outreachSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid #1e293b",
  },
  tabRow: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    appearance: "none",
    flex: 1,
    border: "1px solid #334155",
    background: "#020617",
    color: "#94a3b8",
    fontWeight: 650,
    fontSize: 13,
    padding: "9px 10px",
    borderRadius: 8,
    cursor: "pointer",
  },
  tabButtonActive: {
    border: "1px solid #38bdf8",
    background: "#0f172a",
    color: "#e2e8f0",
  },
  outputBox: {
    marginTop: 16,
    border: "1px solid #1e293b",
    background: "#020617",
    borderRadius: 10,
    overflow: "hidden",
  },
  outputHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #1e293b",
  },
  outputLabel: {
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: 650,
  },
  copyButton: {
    appearance: "none",
    border: "1px solid #334155",
    background: "transparent",
    color: "#7dd3fc",
    borderRadius: 6,
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 650,
  },
  outputText: {
    margin: 0,
    padding: 14,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: 14,
    lineHeight: 1.55,
    color: "#e2e8f0",
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  viewToggle: {
    display: "inline-flex",
    gap: 4,
    padding: 4,
    marginBottom: 20,
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 10,
  },
  viewToggleButton: {
    appearance: "none",
    border: "1px solid transparent",
    background: "transparent",
    color: "#94a3b8",
    fontWeight: 650,
    fontSize: 13,
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  viewToggleButtonActive: {
    background: "#0ea5e9",
    color: "#0b1220",
  },
  boardScroll: {
    overflowX: "auto",
    padding: 16,
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(220px, 1fr))",
    gap: 12,
    alignItems: "stretch",
    minWidth: 1140,
  },
  column: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 10,
    minHeight: 320,
    display: "flex",
    flexDirection: "column",
  },
  columnHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    padding: "12px 12px 10px",
    borderBottom: "1px solid #1e293b",
  },
  columnTitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#cbd5e1",
  },
  columnCount: {
    fontSize: 12,
    color: "#94a3b8",
    background: "#111827",
    borderRadius: 999,
    padding: "2px 8px",
    fontVariantNumeric: "tabular-nums",
  },
  columnBody: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 10,
    flex: 1,
  },
  card: {
    appearance: "none",
    textAlign: "left",
    width: "100%",
    border: "1px solid #1e293b",
    background: "#111827",
    color: "#e2e8f0",
    borderRadius: 10,
    padding: "12px 12px 10px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  cardSelected: {
    border: "1px solid #38bdf8",
    background: "#172554",
  },
  cardName: {
    margin: 0,
    fontSize: 14,
    fontWeight: 650,
  },
  cardMeta: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 1.4,
  },
  cardScore: {
    margin: "8px 0 0",
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#7dd3fc",
    fontWeight: 650,
  },
  columnEmpty: {
    margin: 0,
    padding: "18px 8px",
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
  },
};

function displayValue(contact, key) {
  const value = contact?.[key];
  if (value == null || value === "") {
    return "—";
  }
  return String(value);
}

function contactName(contact) {
  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim();
  return name || contact?.email || "Prospect";
}

function apiError(payload, fallback) {
  const detail = payload?.detail;
  if (typeof detail === "string" && detail) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length) {
    return detail.map((item) => item.msg || JSON.stringify(item)).join(" ");
  }
  return fallback;
}

function App() {
  const fileInputRef = useRef(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [profileText, setProfileText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [outreachTab, setOutreachTab] = useState("icebreaker");
  const [icebreakerStyle, setIcebreakerStyle] = useState("Insight-Led");
  const [postText, setPostText] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState("directory");

  const applyUpdatedContact = (updated) => {
    setContacts((current) =>
      current.map((contact) => (contact.id === updated.id ? { ...contact, ...updated } : contact))
    );
    setSelectedContact((current) => (current ? { ...current, ...updated } : updated));
  };

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(CONTACTS_URL);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(apiError(payload, "Could not load contacts."));
      }
      setContacts(Array.isArray(payload.items) ? payload.items : []);
    } catch (err) {
      setContacts([]);
      setError(err.message || "Could not load contacts.");
    } finally {
      setLoading(false);
    }
  }, []);

  const closePanel = useCallback(() => {
    setSelectedContact(null);
    setProfileText("");
    setPanelError("");
    setRefreshing(false);
    setUpdatingStage(false);
    setOutreachTab("icebreaker");
    setIcebreakerStyle("Insight-Led");
    setPostText("");
    setGeneratedMessage("");
    setGenerating(false);
    setCopied(false);
  }, []);

  const openPanel = (contact) => {
    setSelectedContact(contact);
    setProfileText("");
    setPanelError("");
    setError("");
    setOutreachTab("icebreaker");
    setIcebreakerStyle("Insight-Led");
    setPostText("");
    setGeneratedMessage("");
    setCopied(false);
  };

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.background = "#0b1220";
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!selectedContact) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedContact, closePanel]);

  const uploadCsv = async (file) => {
    if (!file) {
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(IMPORT_URL, {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(apiError(payload, "CSV import failed."));
      }
      setNotice(`Imported ${payload.imported ?? 0} connection${payload.imported === 1 ? "" : "s"}.`);
      await loadContacts();
    } catch (err) {
      setError(err.message || "CSV import failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const refreshWithAi = async () => {
    if (!selectedContact?.id) {
      setPanelError("This contact is missing an id, so it cannot be updated.");
      return;
    }
    if (!profileText.trim()) {
      setPanelError("Paste the current profile headline or experience first.");
      return;
    }
    setRefreshing(true);
    setPanelError("");
    setNotice("");
    try {
      const response = await fetch(REFRESH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: selectedContact.id,
          profile_text: profileText,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(apiError(payload, "Profile refresh failed."));
      }
      const updated = payload.item || {
        ...selectedContact,
        current_title: payload.current_title,
        current_company: payload.current_company,
      };
      applyUpdatedContact(updated);
      setNotice(
        `Updated ${contactName(updated)} to ${payload.current_title || "—"} at ${
          payload.current_company || "—"
        }.`
      );
    } catch (err) {
      setPanelError(err.message || "Profile refresh failed.");
    } finally {
      setRefreshing(false);
    }
  };

  const updateStage = async (pipelineStage) => {
    if (!selectedContact?.id) {
      setPanelError("This contact is missing an id, so it cannot be updated.");
      return;
    }
    if (selectedContact.pipeline_stage === pipelineStage) {
      return;
    }
    const previousStage = selectedContact.pipeline_stage;
    const optimistic = { ...selectedContact, pipeline_stage: pipelineStage };
    applyUpdatedContact(optimistic);
    setUpdatingStage(true);
    setPanelError("");
    setNotice("");
    try {
      const response = await fetch(UPDATE_STAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: selectedContact.id,
          pipeline_stage: pipelineStage,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(apiError(payload, "Could not update pipeline stage."));
      }
      const updated = payload.item || optimistic;
      applyUpdatedContact(updated);
      setNotice(`Moved ${contactName(updated)} to ${updated.pipeline_stage || pipelineStage}.`);
    } catch (err) {
      applyUpdatedContact({ ...selectedContact, pipeline_stage: previousStage });
      setPanelError(err.message || "Could not update pipeline stage.");
    } finally {
      setUpdatingStage(false);
    }
  };

  const generateOutreach = async (kind) => {
    if (!selectedContact) {
      return;
    }
    if (kind === "comment" && !postText.trim()) {
      setPanelError("Paste one of their recent LinkedIn posts first.");
      return;
    }
    setGenerating(true);
    setPanelError("");
    setCopied(false);
    const roleContext = [
      selectedContact.current_title,
      selectedContact.current_company,
      profileText.trim(),
    ]
      .filter(Boolean)
      .join(" | ");
    const payload = {
      contact_name: contactName(selectedContact),
      current_title: selectedContact.current_title || "",
      current_company: selectedContact.current_company || "",
      channel: "linkedin",
      kind,
      style: kind === "icebreaker" ? icebreakerStyle : null,
      context: kind === "comment" ? postText.trim() : roleContext,
      goal: kind === "comment" ? "draft a thoughtful LinkedIn comment" : "start a LinkedIn conversation",
    };
    try {
      const response = await fetch(GENERATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(apiError(result, "Could not generate outreach."));
      }
      setGeneratedMessage(result.message || "");
    } catch (err) {
      setPanelError(err.message || "Could not generate outreach.");
    } finally {
      setGenerating(false);
    }
  };

  const copyGeneratedMessage = async () => {
    if (!generatedMessage) {
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
    } catch {
      setPanelError("Could not copy to clipboard.");
    }
  };

  const rows = useMemo(() => contacts, [contacts]);

  const contactsByStage = useMemo(() => {
    const grouped = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, []]));
    contacts.forEach((contact) => {
      const stage = PIPELINE_STAGES.includes(contact?.pipeline_stage)
        ? contact.pipeline_stage
        : "Identified";
      grouped[stage].push(contact);
    });
    return grouped;
  }, [contacts]);

  return (
    <main style={styles.page}>
      <style>{`
        .contact-row { cursor: pointer; }
        .contact-row:hover td { background: #1e293b; }
        .contact-row.selected td { background: #172554; }
        .kanban-card:hover { border-color: #38bdf8; }
      `}</style>
      <div style={styles.viewToggle} role="group" aria-label="Choose a view">
        <button
          type="button"
          aria-pressed={viewMode === "directory"}
          style={{
            ...styles.viewToggleButton,
            ...(viewMode === "directory" ? styles.viewToggleButtonActive : {}),
          }}
          onClick={() => setViewMode("directory")}
        >
          Directory View
        </button>
        <button
          type="button"
          aria-pressed={viewMode === "board"}
          style={{
            ...styles.viewToggleButton,
            ...(viewMode === "board" ? styles.viewToggleButtonActive : {}),
          }}
          onClick={() => setViewMode("board")}
        >
          Pipeline Board
        </button>
      </div>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Command Center</p>
          <h1 style={styles.title}>Engagement Engine</h1>
          <p style={styles.subtitle}>Import LinkedIn connections and review the live contact list.</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={styles.hiddenInput}
            onChange={(event) => uploadCsv(event.target.files?.[0])}
          />
          <button
            type="button"
            style={{
              ...styles.uploadButton,
              ...(uploading ? styles.uploadButtonDisabled : {}),
            }}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "CSV Upload"}
          </button>
        </div>
      </header>

      {notice ? <div style={{ ...styles.banner, ...styles.bannerOk }}>{notice}</div> : null}
      {error ? <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div> : null}

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <h2 style={styles.panelTitle}>Contacts</h2>
          <span style={styles.count}>{loading ? "Loading…" : `${rows.length} records`}</span>
        </div>
        {loading ? (
          <div style={styles.empty}>Fetching contacts from the API…</div>
        ) : viewMode === "board" ? (
          <div style={styles.boardScroll}>
            <div style={styles.board} aria-label="Pipeline board">
              {PIPELINE_STAGES.map((stage) => {
                const stageContacts = contactsByStage[stage];
                return (
                  <section key={stage} style={styles.column} aria-label={`${stage} column`}>
                    <div style={styles.columnHeader}>
                      <h3 style={styles.columnTitle}>{stage}</h3>
                      <span style={styles.columnCount}>{stageContacts.length}</span>
                    </div>
                    <div style={styles.columnBody}>
                      {stageContacts.length === 0 ? (
                        <p style={styles.columnEmpty}>No contacts</p>
                      ) : (
                        stageContacts.map((contact, index) => {
                          const selected = Boolean(
                            selectedContact?.id && selectedContact.id === contact.id
                          );
                          return (
                            <button
                              key={contact.id || contact.email || `${stage}-${index}`}
                              type="button"
                              className={`kanban-card${selected ? " selected" : ""}`}
                              aria-label={`Open prospect panel for ${contactName(contact)}`}
                              style={{
                                ...styles.card,
                                ...(selected ? styles.cardSelected : {}),
                              }}
                              onClick={() => openPanel(contact)}
                            >
                              <p style={styles.cardName}>{contactName(contact)}</p>
                              <p style={styles.cardMeta}>{displayValue(contact, "current_title")}</p>
                              <p style={styles.cardMeta}>{displayValue(contact, "current_company")}</p>
                              {contact.ai_score_total != null && contact.ai_score_total !== "" ? (
                                <p style={styles.cardScore}>Score {contact.ai_score_total}</p>
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div style={styles.empty}>No contacts yet. Upload a LinkedIn connections CSV to populate this table.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.key} style={styles.th}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((contact, index) => (
                  <tr
                    key={contact.id || contact.email || contact.linkedin_url || index}
                    className={`contact-row${selectedContact?.id && selectedContact.id === contact.id ? " selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open prospect panel for ${contactName(contact)}`}
                    onClick={() => openPanel(contact)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openPanel(contact);
                      }
                    }}
                  >
                    {COLUMNS.map((column) => (
                      <td key={column.key} style={styles.td}>
                        {column.key === "profile_url" && contact.profile_url ? (
                          <a
                            href={contact.profile_url}
                            style={styles.link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Profile
                          </a>
                        ) : (
                          displayValue(contact, column.key)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedContact ? (
        <>
          <div style={styles.overlay} onClick={closePanel} />
          <aside style={styles.drawer} aria-label="Prospect Panel">
            <div style={styles.drawerHeader}>
              <div>
                <p style={styles.eyebrow}>Prospect Panel</p>
                <h2 style={styles.drawerName}>{contactName(selectedContact)}</h2>
              </div>
              <button type="button" style={styles.closeButton} onClick={closePanel}>
                Close
              </button>
            </div>
            <div style={styles.drawerBody}>
              <div style={styles.metaGrid}>
                <div>
                  <p style={styles.metaLabel}>Current title</p>
                  <p style={styles.metaValue}>{displayValue(selectedContact, "current_title")}</p>
                </div>
                <div>
                  <p style={styles.metaLabel}>Current company</p>
                  <p style={styles.metaValue}>{displayValue(selectedContact, "current_company")}</p>
                </div>
              </div>
              <div style={styles.stageBlock}>
                <p style={styles.fieldLabel} id="pipeline-stage-label">
                  Pipeline Stage
                </p>
                <div style={styles.stageRow} role="group" aria-labelledby="pipeline-stage-label">
                  {PIPELINE_STAGES.map((stage) => {
                    const active = selectedContact.pipeline_stage === stage;
                    return (
                      <button
                        key={stage}
                        type="button"
                        disabled={updatingStage}
                        style={{
                          ...styles.stageButton,
                          ...(active ? styles.stageButtonActive : {}),
                          ...(updatingStage ? styles.uploadButtonDisabled : {}),
                        }}
                        onClick={() => updateStage(stage)}
                      >
                        {stage}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label style={styles.fieldLabel} htmlFor="profile-refresh-text">
                Paste Current Profile Headline/Experience
              </label>
              <textarea
                id="profile-refresh-text"
                style={styles.textarea}
                value={profileText}
                onChange={(event) => setProfileText(event.target.value)}
                placeholder="Paste the LinkedIn headline and latest experience here…"
              />
              <button
                type="button"
                style={{
                  ...styles.refreshButton,
                  ...(refreshing || !profileText.trim() ? styles.uploadButtonDisabled : {}),
                }}
                disabled={refreshing || !profileText.trim()}
                onClick={refreshWithAi}
              >
                {refreshing ? "Refreshing…" : "Refresh with AI"}
              </button>

              <section style={styles.outreachSection} aria-label="Outreach Tools">
                <p style={styles.fieldLabel}>Outreach Tools</p>
                <div style={styles.tabRow} aria-label="Outreach tools">
                  <button
                    type="button"
                    aria-pressed={outreachTab === "icebreaker"}
                    style={{
                      ...styles.tabButton,
                      ...(outreachTab === "icebreaker" ? styles.tabButtonActive : {}),
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOutreachTab("icebreaker");
                    }}
                  >
                    Icebreaker
                  </button>
                  <button
                    type="button"
                    aria-pressed={outreachTab === "comment"}
                    style={{
                      ...styles.tabButton,
                      ...(outreachTab === "comment" ? styles.tabButtonActive : {}),
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOutreachTab("comment");
                    }}
                  >
                    Comment Drafter
                  </button>
                </div>

                {outreachTab === "icebreaker" ? (
                  <>
                    <div style={styles.stageRow} role="group" aria-label="Icebreaker style">
                      {ICEBREAKER_STYLES.map((style) => {
                        const active = icebreakerStyle === style;
                        return (
                          <button
                            key={style}
                            type="button"
                            style={{
                              ...styles.stageButton,
                              ...(active ? styles.stageButtonActive : {}),
                            }}
                            onClick={() => setIcebreakerStyle(style)}
                          >
                            {style}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      style={{
                        ...styles.refreshButton,
                        ...(generating ? styles.uploadButtonDisabled : {}),
                      }}
                      disabled={generating}
                      onClick={() => generateOutreach("icebreaker")}
                    >
                      {generating ? "Generating…" : "Generate Icebreaker"}
                    </button>
                  </>
                ) : (
                  <>
                    <label style={styles.fieldLabel} htmlFor="linkedin-post-text">
                      Recent LinkedIn post
                    </label>
                    <textarea
                      id="linkedin-post-text"
                      style={styles.textarea}
                      value={postText}
                      onChange={(event) => setPostText(event.target.value)}
                      placeholder="Paste one of their recent LinkedIn posts here..."
                    />
                    <button
                      type="button"
                      style={{
                        ...styles.refreshButton,
                        ...(generating || !postText.trim() ? styles.uploadButtonDisabled : {}),
                      }}
                      disabled={generating || !postText.trim()}
                      onClick={() => generateOutreach("comment")}
                    >
                      {generating ? "Drafting…" : "Draft Comment"}
                    </button>
                  </>
                )}

                {generatedMessage ? (
                  <div style={styles.outputBox}>
                    <div style={styles.outputHeader}>
                      <p style={styles.outputLabel}>Generated copy</p>
                      <button type="button" style={styles.copyButton} onClick={copyGeneratedMessage}>
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p style={styles.outputText}>{generatedMessage}</p>
                  </div>
                ) : null}
              </section>
              {panelError ? <div style={styles.panelError}>{panelError}</div> : null}
            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}

export default App;
