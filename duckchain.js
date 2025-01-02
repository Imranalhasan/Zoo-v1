const fs = require("fs");
const path = require("path");
const axios = require("axios");
const colors = require("colors");
const readline = require("readline");
const user_agents = require("./config/userAgents");
const settings = require("./config/config");
const { sleep, getRandomNumber, loadData, getOrCreateJSON } = require("./utils");
const { checkBaseUrl } = require("./checkAPI");
require("dotenv").config();

const axiosInstance = axios.create({
  timeout: 10000,
});

class DuckChainAPIClient {
  constructor() {
    this.headers = {
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
      Origin: "https://tgdapp.duckchain.io",
      Referer: "https://tgdapp.duckchain.io/",
      "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    };
    this.session_name = null;
    this.session_user_agents = this.#load_session_data();
    this.baseURL = settings.BASE_URL;
  }

  #load_session_data() {
    try {
      const filePath = path.join(__dirname, "session_user_agents.json");
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      } else {
        throw error;
      }
    }
  }

  #get_random_user_agent() {
    const randomIndex = Math.floor(Math.random() * user_agents.length);
    return user_agents[randomIndex];
  }

  #get_user_agent() {
    if (this.session_user_agents[this.session_name]) {
      return this.session_user_agents[this.session_name];
    }

    this.log(`Tạo user agent...`);
    const newUserAgent = this.#get_random_user_agent();
    this.session_user_agents[this.session_name] = newUserAgent;
    this.#save_session_data(this.session_user_agents);
    return newUserAgent;
  }

  #save_session_data(session_user_agents) {
    const filePath = path.join(__dirname, "session_user_agents.json");
    fs.writeFileSync(filePath, JSON.stringify(session_user_agents, null, 2));
  }

  #get_platform(userAgent) {
    const platformPatterns = [
      { pattern: /iPhone/i, platform: "ios" },
      { pattern: /Android/i, platform: "android" },
      { pattern: /iPad/i, platform: "ios" },
    ];

    for (const { pattern, platform } of platformPatterns) {
      if (pattern.test(userAgent)) {
        return platform;
      }
    }

    return "Unknown";
  }

  async #set_headers() {
    const platform = this.#get_platform(this.#get_user_agent());
    this.headers["sec-ch-ua"] = `"Not)A;Brand";v="99", "${platform} WebView";v="127", "Chromium";v="127`;
    this.headers["sec-ch-ua-platform"] = platform;
    this.headers["User-Agent"] = this.#get_user_agent();
  }

  log(msg, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    switch (type) {
      case "success":
        console.log(`[${timestamp}] [*] ${msg}`.green);
        break;
      case "custom":
        console.log(`[${timestamp}] [*] ${msg}`.magenta);
        break;
      case "error":
        console.log(`[${timestamp}] [*] ${msg}`.red);
        break;
      case "warning":
        console.log(`[${timestamp}] [*] ${msg}`.yellow);
        break;
      default:
        console.log(`[${timestamp}] [*] ${msg}`.blue);
    }
  }

  async countdown(seconds) {
    for (let i = seconds; i > 0; i--) {
      const timestamp = new Date().toLocaleTimeString();
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
  }

  async getUserInfo(authorization) {
    let retries = 0;
    try {
      const response = await axiosInstance.get(`${this.baseURL}/user/info`, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });

      if (response.data.code === 200) {
        return { success: true, data: response.data.data };
      } else {
        if (retries < 2) {
          this.log(`Đang thử lại....lần ${retries + 1}/2...`);
          await sleep(2);
        }
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setDuckName(authorization, duckName) {
    try {
      const encodedDuckName = encodeURIComponent(duckName);
      const response = await axiosInstance.get(`${this.baseURL}/user/set_duck_name?duckName=${encodedDuckName}`, {
        headers: {
          ...this.headers,
          Authorization: authorization,
        },
      });

      if (response.data.code === 200) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTaskList(authorization) {
    try {
      const response = await axiosInstance.get(`${this.baseURL}/task/task_list`, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });

      if (response.data.code === 200) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTaskInfo(authorization) {
    try {
      const response = await axiosInstance.get(`${this.baseURL}/task/task_info`, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });

      if (response.data.code === 200) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async performDailyCheckIn(authorization) {
    try {
      const response = await axiosInstance.get(`${this.baseURL}/task/sign_in?`, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });

      if (response.data.code === 200) {
        this.log("Điểm danh hàng ngày thành công", "success");
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async completeTask(authorization, task) {
    try {
      const response = await axiosInstance.get(`${this.baseURL}/task/onetime?taskId=${task.taskId}`, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });

      if (response.data.code === 200) {
        this.log(`Làm nhiệm vụ ${task.content} thành công | Phần thưởng: ${task.integral} DUCK`, "success");
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async completeTask2(authorization, task) {
    try {
      const response = await axios.get(`https://aad.duckchain.io/task/partner?taskId=${task.taskId}`, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });

      if (response.data.code === 200) {
        this.log(`Completed task ${task.content} successfully | Reward: ${task.integral} DUCK`, "success");
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async collectDailyEgg(authorization) {
    try {
      const checkResponse = await axios.get(`${this.baseURL}/property/daily/isfinish?taskId=1`, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });

      if (checkResponse.data.code === 200) {
        if (checkResponse.data.data === 0) {
          const collectResponse = await axios.get(`${this.baseURL}/property/daily/finish?taskId=1`, {
            headers: {
              ...this.headers,
              Authorization: `tma ${authorization}`,
            },
          });

          if (collectResponse.data.code === 200 && collectResponse.data.data === true) {
            this.log("Nhặt trứng thành công", "success");
            return { success: true, data: collectResponse.data.data };
          } else {
            return { success: false, error: collectResponse.data.message };
          }
        } else {
          this.log("Đã nhặt trứng hôm nay rồi", "warning");
          return { success: false, error: "Already collected today" };
        }
      } else {
        return { success: false, error: checkResponse.data.message };
      }
    } catch (error) {
      this.log(`Lỗi khi nhặt trứng: ${error.message}`, "error");
      return { success: false, error: error.message };
    }
  }

  async processAllTasks(authorization) {
    try {
      this.log("Đang kiểm tra và nhặt trứng hàng ngày...", "info");
      await this.collectDailyEgg(authorization);
      await sleep(3);
      const taskInfo = await this.getTaskInfo(authorization);
      if (!taskInfo.success) {
        this.log(`Không thể lấy thông tin nhiệm vụ: ${taskInfo.error}`, "error");
        return;
      }
      await sleep(2);
      const { daily: completedDaily, oneTime: completedOneTime, partner: completedPartner } = taskInfo.data;

      const skipTask = [...completedDaily, ...completedOneTime, ...completedPartner, ...settings.SKIP_TASKS];

      const taskList = await this.getTaskList(authorization);
      if (!taskList.success) {
        this.log(`Không thể lấy danh sách nhiệm vụ: ${taskList.error}`, "error");
        return;
      }

      // const tasks = Object.values(taskList.data)
      //   .flatMap((item) => item)
      //   .filter((task) => !skipTask.includes(task.taskId));

      // if (tasks && Array.isArray(tasks)) {
      //   for (const task of tasks) {
      //     if (task.taskId === 8 && !completedDaily.includes(8)) {
      //       this.log("Đang thực hiện điểm danh hàng ngày...", "info");
      //       await sleep(2);
      //       await this.performDailyCheckIn(authorization);
      //     } else if (!completedOneTime.includes(task.taskId)) {
      //       this.log(`Đang thực hiện nhiệm vụ ${task.taskId}: ${task.content}...Đợi 5 giây...`, "info");
      //       await sleep(5);
      //       await this.completeTask(authorization, task);
      //     }
      //   }
      // }

      const { daily, oneTime, partner, social_media } = taskList.data;

      if (daily && Array.isArray(daily)) {
        for (const task of daily) {
          await sleep(2);
          if (task.taskId === 8 && !completedDaily.includes(8)) {
            this.log("Đang thực hiện điểm danh hàng ngày...", "info");
            await this.performDailyCheckIn(authorization);
          }
        }
      }

      if (oneTime && Array.isArray(oneTime)) {
        for (const task of oneTime) {
          if (!completedOneTime.includes(task.taskId)) {
            this.log(`Đang thực hiện nhiệm vụ: ${task.content}...Đợi 5 giây...`, "info");
            await sleep(5);
            await this.completeTask(authorization, task);
          }
        }
      }

      if (partner && Array.isArray(partner)) {
        for (const task of partner) {
          if (!completedPartner.includes(task.taskId)) {
            this.log(`Đang thực hiện nhiệm vụ đối tác: ${task.content}......Đợi 5 giây...`, "info");
            await sleep(5);
            await this.completeTask2(authorization, task);
          }
        }
      }

      this.log("Hoàn thành xử lý tất cả nhiệm vụ", "success");
    } catch (error) {
      this.log(`Lỗi khi xử lý nhiệm vụ: ${error.message}`, "error");
    }
  }

  async executeQuack(authorization) {
    try {
      const response = await axiosInstance.get(`${this.baseURL}/quack/execute`, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });

      if (response.data.code === 200) {
        const { quackRecords, quackTimes, decibel } = response.data.data;
        const totalNegative = quackRecords.reduce((sum, num) => {
          const value = parseInt(num);
          return sum + (value < 0 ? value : 0);
        }, 0);

        this.log(`Quack lần ${quackTimes} | Tổng ducks kiếm được: ${totalNegative}  | Ducks còn lại: ${decibel}`, "custom");
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processQuacks(authorization, decibels, maxQuackTimes = 0) {
    this.log(`Bắt đầu quack với ${decibels} ducks`, "info");
    let quackCount = 0;

    while (decibels > 0 && (maxQuackTimes === 0 || quackCount < maxQuackTimes)) {
      const result = await this.executeQuack(authorization);
      if (!result.success) {
        this.log(`Lỗi khi quack: ${result.error}`, "error");
        break;
      }
      decibels = parseInt(result.data.decibel);
      quackCount++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.log("Hoàn thành quack!", "success");
  }

  askQuestion(query) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) =>
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans);
      })
    );
  }

  async main() {
    const dataFile = path.join(__dirname, "data.txt");
    const data = fs.readFileSync(dataFile, "utf8").replace(/\r/g, "").split("\n").filter(Boolean);
    console.log("Tool được phát triển bởi nhóm tele Airdrop Hunter Siêu Tốc (https://t.me/airdrophuntersieutoc)".yellow);
    const { endpoint: hasIDAPI, message } = await checkBaseUrl();
    if (!hasIDAPI) return console.log(`Không thể tìm thấy ID API, thử lại sau!`.red);
    console.log(`${message}`.yellow);
    this.baseURL = hasIDAPI;
    const hoiquacktime = settings.AUTO_QUACK;
    let maxQuackTimes = getRandomNumber(settings.AMOUNT_TAP_QUACK[0], settings.AMOUNT_TAP_QUACK[1]);

    while (true) {
      for (let i = 0; i < data.length; i++) {
        const authorization = data[i];
        const userData = JSON.parse(decodeURIComponent(authorization.split("user=")[1].split("&")[0]));
        const firstName = userData.first_name || "";
        const lastName = userData.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim();
        this.session_name = userData.id;

        console.log(`========== Tài khoản ${i + 1} | ${fullName.green} ==========`);
        this.#set_headers();

        this.log(`Đang kiểm tra thông tin tài khoản...`, "info");
        let userInfo = await this.getUserInfo(authorization);
        await sleep(1);
        if (userInfo.success) {
          this.log(`Lấy thông tin thành công!`, "success");

          if (userInfo.data.duckName === null) {
            this.log(`Đang thiết lập tên duck...`, "info");

            const setNameResult = await this.setDuckName(authorization, fullName);
            if (setNameResult.success) {
              this.log(`Đặt tên duck thành công: ${setNameResult.data.duckName}`, "success");
              this.log(`Ducks: ${setNameResult.data.decibels}`, "custom");
              if (hoiquacktime && setNameResult.data.decibels > 0) {
                await this.processQuacks(authorization, setNameResult.data.decibels, maxQuackTimes);
              }
            } else {
              this.log(`Không thể đặt tên duck: ${setNameResult.error}`, "error");
            }
          } else {
            this.log(`Duck name đã được thiết lập: ${userInfo.data.duckName}`, "info");
            if (userInfo.data.decibels) {
              this.log(`Ducks: ${userInfo.data.decibels}`, "custom");
              if (hoiquacktime && userInfo.data.decibels > 0) {
                await this.processQuacks(authorization, userInfo.data.decibels, maxQuackTimes);
              }
            }
          }
        } else {
          this.log(`Không thể lấy thông tin tài khoản: ${userInfo.error}`, "error");
        }

        if (settings.AUTO_TASK) {
          this.log("Đang xử lý nhiệm vụ...", "info");
          await this.processAllTasks(authorization);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      // updateEnv("CLAIM_FAUCET", "false");
      await sleep(3);
      await this.countdown(settings.TIME_SLEEP * 60 * 60);
    }
  }
}

const client = new DuckChainAPIClient();
client.main().catch((err) => {
  client.log(err.message, "error");
  process.exit(1);
});
