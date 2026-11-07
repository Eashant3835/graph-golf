import React from "react";

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#1c2a22",
    margin: 0,
    padding: "16px",
    boxSizing: "border-box",
  },
  box: {
    width: "min(90vw, 960px)",
    aspectRatio: "16 / 9",
    background: "#e9efe4",
    border: "3px solid #0f1813",
    borderRadius: "12px",
    overflow: "hidden",
    position: "relative",
  },
};

export default function GameScreen() {
  return (
    <div style={styles.page}>
      {/* Your game goes inside this box (canvas, Phaser, game components, etc.) */}
      <div style={styles.box} id="game-container" />
    </div>
  );
}
