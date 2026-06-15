import Header from "@/components/Header";
import SearchBox from "@/components/SearchBox";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <SearchBox />
        
        <footer style={{ position: "absolute", bottom: "20px", color: "var(--secondary-text)", fontSize: "0.9rem" }}>
          تم التصميم لخدمة طلاب الطور الثانوي في الجزائر
        </footer>
      </main>
    </div>
  );
}

