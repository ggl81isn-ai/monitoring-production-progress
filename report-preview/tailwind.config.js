/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./src/**/*.css"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Segoe UI"',
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Noto Sans JP"',
          "Meiryo",
          "sans-serif",
        ],
      },
      colors: {
        ink: "#1a1d21",
        muted: "#5c6370",
      },
      boxShadow: {
        card: "0 4px 24px rgba(15, 23, 42, 0.06)",
      },
      maxWidth: {
        report: "560px",
      },
      spacing: {
        report: "18px",
        "report-x": "22px",
        "report-pt": "26px",
        "report-sec": "18px",
      },
    },
  },
  plugins: [],
};
