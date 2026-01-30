import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { supabase } from "./supabase";

function useHashRoute() {
  // роутинг без сервера: #/b/slug
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHashRoute();
  const route = useMemo(() => {
    const h = hash.replace(/^#/, "");
    const parts = h.split("/").filter(Boolean);
    if (parts[0] === "b" && parts[1]) return { page: "board", slug: parts[1] };
    return { page: "home" };
  }, [hash]);

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="h1">Boards</h1>
          <div className="muted">Public view (published only)</div>
        </div>
        <span className="badge">dark MVP</span>
      </div>

      {route.page === "home" ? <BoardsList /> : <BoardView slug={route.slug} />}
    </div>
  );
}

function BoardsList() {
  const [boards, setBoards] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("boards")
        .select("id,title,slug,updated_at")
        .order("updated_at", { ascending: false });

      if (!alive) return;
      if (error) {
        console.error(error);
        setBoards([]);
      } else {
        setBoards(data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = boards.filter((b) =>
    (b.title + " " + b.slug).toLowerCase().includes(q.toLowerCase().trim())
  );

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <input
          className="input"
          placeholder="Search boards…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" onClick={() => (window.location.hash = "#/")}>
          Home
        </button>
      </div>

      {loading ? (
        <div className="muted">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="muted">No published boards found.</div>
      ) : (
        <div className="grid">
          {filtered.map((b) => (
            <a key={b.id} className="card" href={`#/b/${b.slug}`}>
              <div className="pad">
                <div className="title">{b.title}</div>
                <div className="desc">Open board</div>
                <div className="muted">{b.slug}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function BoardView({ slug }) {
  const [board, setBoard] = useState(null);
  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  const [selectedCat, setSelectedCat] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      const { data: b, error: be } = await supabase
        .from("boards")
        .select("id,title,slug,background_url")
        .eq("slug", slug)
        .maybeSingle();

      if (!alive) return;
      if (be || !b) {
        console.error(be);
        setBoard(null);
        setCategories([]);
        setCards([]);
        setLoading(false);
        return;
      }

      // categories
      const { data: cat, error: catErr } = await supabase
        .from("categories")
        .select("id,title,order_index")
        .eq("board_id", b.id)
        .order("order_index", { ascending: true });

      if (catErr) console.error(catErr);

      // cards
      const { data: c, error: ce } = await supabase
        .from("cards")
        .select("id,title,description,image_url,link_url,order_index,category_id")
        .eq("board_id", b.id)
        .order("order_index", { ascending: true });

      if (ce) console.error(ce);

      setBoard(b);
      setCategories(cat ?? []);
      setCards(c ?? []);
      setSelectedCat("all");
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  const filteredCards =
    selectedCat === "all" ? cards : cards.filter((c) => c.category_id === selectedCat);

  // (опционально) фон доски
  useEffect(() => {
    if (!board?.background_url) return;
    const prev = document.body.style.backgroundImage;
    const prevSize = document.body.style.backgroundSize;
    const prevPos = document.body.style.backgroundPosition;
    const prevAttach = document.body.style.backgroundAttachment;

    document.body.style.backgroundImage = `url(${board.background_url})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundAttachment = "fixed";

    return () => {
      document.body.style.backgroundImage = prev;
      document.body.style.backgroundSize = prevSize;
      document.body.style.backgroundPosition = prevPos;
      document.body.style.backgroundAttachment = prevAttach;
    };
  }, [board?.background_url]);

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={() => (window.location.hash = "#/")}>
          ← Back
        </button>
        <span className="badge">{slug}</span>
      </div>

      {loading ? (
        <div className="muted">Loading…</div>
      ) : !board ? (
        <div className="muted">Board not found (or not published).</div>
      ) : (
        <>
          <h2 style={{ margin: "8px 0 6px" }}>{board.title}</h2>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${selectedCat === "all" ? "active" : ""}`}
              onClick={() => setSelectedCat("all")}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`tab ${selectedCat === cat.id ? "active" : ""}`}
                onClick={() => setSelectedCat(cat.id)}
              >
                {cat.title}
              </button>
            ))}
          </div>

          <div className="grid">
            {filteredCards.map((c) => (
              <a
                key={c.id}
                className="card"
                href={c.link_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!c.link_url) e.preventDefault();
                }}
                title={c.link_url || ""}
              >
                {c.image_url ? <img src={c.image_url} alt="" /> : <div style={{ height: 210 }} />}
                <div className="pad">
                  <div className="title">{c.title}</div>
                  {c.description ? <div className="desc">{c.description}</div> : null}
                  {c.link_url ? (
                    <div className="muted">Open link ↗</div>
                  ) : (
                    <div className="muted">No link</div>
                  )}
                </div>
              </a>
            ))}
          </div>

          {filteredCards.length === 0 ? (
            <div className="muted" style={{ marginTop: 12 }}>
              No cards in this category.
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

