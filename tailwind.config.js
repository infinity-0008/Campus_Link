export default {
  darkMode: ["class"],
  content: ["./client/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#101114",
          "navy-soft": "#24262B",
          teal: "#E0231C",
          "teal-soft": "#FDECEA",
          ink: "#242429",
          muted: "#70747D",
          soft: "#F5F5F4",
          red: "#E0231C",
          "red-dark": "#BF1D17",
          charcoal: "#08090B",
        },
      },
      boxShadow: {
        soft: "0 8px 30px rgba(17, 24, 39, .06)",
        lift: "0 16px 50px rgba(17, 24, 39, .10)",
      },
      borderRadius: { xl2: "1.125rem" },
    },
  },
};
