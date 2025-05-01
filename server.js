const app = require("./app");
const start = require("./swap");

const { PORT } = process.env;

app.listen(PORT, () => {
  start().catch((error) => {
    console.error("Ошибка при запуске:", error);
  });

  console.log(`Server running. Use our API on port: ${PORT}`);
});
