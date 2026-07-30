module.exports = {
  apps: [
    {
      name: "cpmsoft-platform-console",
      cwd: "/var/www/backend/cpmsoft-platform-console",
      script: "server.js",

      env: {
        NODE_ENV: "production",

        HOST: "127.0.0.1",
        PORT: "4100",

        SMTP_HOST: "smtp.office365.com",
        SMTP_PORT: "587",
        SMTP_USER: "vasu@cpmsoft.com",
        SMTP_PASS: "CpmSoftRam@lak1!",
        SMTP_FROM: "CPMSOFT <vasu@cpmsoft.com>"
      }
    }
  ]
};