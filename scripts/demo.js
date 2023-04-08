/**
 * Demo Data
 */
function Data() {
  return Process(
    "yao.table.Insert",
    "pet",
    ["name", "type", "status", "mode", "stay", "cost"],
    [
      ["Cookie", "cat", "checked", "enabled", 200, 105],
      ["Baby", "dog", "checked", "enabled", 186, 24],
      ["Poo", "others", "checked", "enabled", 199, 66],
    ]
  );
}
