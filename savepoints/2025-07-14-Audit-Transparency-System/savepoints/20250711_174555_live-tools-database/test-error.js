// Test file with ESLint errors
const unusedVariable = 42;
const anotherUnused = "test";

console.log("This should trigger ESLint warning");

function badFunction() {
  let x = 1
  let y = 2
  return x + y
}