const app = require("./app");
const { start } = require("./swap");

const { PORT } = process.env;

app.listen(PORT || 3000, () => {
  start().catch((error) => {
    console.error("Ошибка при запуске:", error);
  });

  console.log(`🚨 Бот запущен 🚨`);
});
