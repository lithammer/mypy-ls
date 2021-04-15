import fs from "fs";
import path from "path";

export const findBinary = (workspaceRoot: string): string => {
  const venv = process.env.VIRTUAL_ENV;
  if (venv !== undefined) {
    return path.join(venv, "bin", "dmypy");
  }

  // virtualenv in the workspace root.
  const files = fs.readdirSync(workspaceRoot);
  for (const file of files) {
    const p = path.join(workspaceRoot, file);

    if (fs.existsSync(path.join(p, "pyvenv.cfg"))) {
      return path.join(p, "bin", "dmypy");
    }
  }

  return "dmypy";
};
