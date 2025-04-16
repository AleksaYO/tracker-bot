const app = require("./app");
const a = require("./swap");

const { PORT } = process.env;

app.listen(PORT, () => {
  // main().catch(console.error);
  a();

  console.log(`Server running. Use our API on port: ${PORT}`);
});
