const fs = require("fs");
const path = require("path");
const axios = require("axios");
const colors = require("colors");
const readline = require("readline");
const { HttpsProxyAgent } = require("https-proxy-agent");
require("dotenv").config();
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const user_agents = require("./config/userAgents");
const settings = require("./config/config");
const { loadData, sleep, getRandomNumber } = require("./utils");
const { checkBaseUrl } = require("./checkAPI");

class DuckChainAPIClient {
  constructor(queryId, accountIndex, proxy, hasIDAPI) {
    this.headers = {
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      Origin: "https://tgdapp.duckchain.io",
      Referer: "https://tgdapp.duckchain.io/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    };
    this.proxies = loadData("proxy.txt");
    this.queryId = queryId;
    this.accountIndex = accountIndex;
    this.proxy = proxy;
    this.proxyIp = "Unknown IP";
    this.session_name = null;
    this.session_user_agents = this.#load_session_data();
    this.baseURL = hasIDAPI;
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

    console.log(`[Tài khoản ${this.accountIndex + 1}] [*] Tạo user agent...`.blue);
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

  createUserAgent() {
    const telegramauth = this.queryId;
    const userData = JSON.parse(decodeURIComponent(telegramauth.split("user=")[1].split("&")[0]));
    this.session_name = userData.id;
    this.#get_user_agent();
  }

  async checkProxyIP(proxy) {
    try {
      const proxyAgent = new HttpsProxyAgent(proxy);
      const response = await axios.get("https://api.ipify.org?format=json", {
        httpsAgent: proxyAgent,
        timeout: 10000,
      });
      if (response.status === 200) {
        return response.data.ip;
      } else {
        throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
    }
  }

  createAxiosInstance(proxyUrl) {
    return axios.create({
      headers: this.headers,
      httpsAgent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
      timeout: 30000,
    });
  }

  log(msg, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    switch (type) {
      case "success":
        console.log(`[${timestamp}] [ Tài khoản ${this.accountIndex + 1}] [${this.proxyIp}] [*] ${msg}`.green);
        break;
      case "custom":
        console.log(`[${timestamp}] [ Tài khoản ${this.accountIndex + 1}] [${this.proxyIp}] [*] ${msg}`.magenta);
        break;
      case "error":
        console.log(`[${timestamp}] [ Tài khoản ${this.accountIndex + 1}] [${this.proxyIp}] [*] ${msg}`.red);
        break;
      case "warning":
        console.log(`[${timestamp}] [ Tài khoản ${this.accountIndex + 1}] [${this.proxyIp}] [*] ${msg}`.yellow);
        break;
      default:
        console.log(`[${timestamp}] [ Tài khoản ${this.accountIndex + 1}] [${this.proxyIp}] [*] ${msg}`.blue);
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

  async getUserInfo(authorization, proxyUrl) {
    try {
      const axiosInstance = this.createAxiosInstance(proxyUrl);
      const response = await axiosInstance.get(`${this.baseURL}/user/info`, {
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

  async setDuckName(authorization, duckName, proxyUrl) {
    try {
      const axiosInstance = this.createAxiosInstance(proxyUrl);
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

  async getTaskList(authorization, proxyUrl) {
    try {
      const axiosInstance = this.createAxiosInstance(proxyUrl);
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

  async getTaskInfo(authorization, proxyUrl) {
    try {
      const axiosInstance = this.createAxiosInstance(proxyUrl);
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

  async performDailyCheckIn(authorization, proxyUrl) {
    try {
      const axiosInstance = this.createAxiosInstance(proxyUrl);
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

  async completeTask(authorization, task, proxyUrl) {
    try {
      const axiosInstance = this.createAxiosInstance(proxyUrl);
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

  async completeTask2(authorization, task, proxyUrl) {
    try {
      const axiosInstance = this.createAxiosInstance(proxyUrl);
      const response = await axiosInstance.get(`https://aad.duckchain.io/task/partner?taskId=${task.taskId}`, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });

      if (response.data.code === 200) {
        this.log(`Successfully completed task ${task.content} | Reward: ${task.integral} DUCK`, "success");
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async collectDailyEgg(authorization, proxyUrl) {
    try {
      const axiosInstance = this.createAxiosInstance(proxyUrl);

      const checkResponse = await axiosInstance.get(`${this.baseURL}/property/daily/isfinish?taskId=1`, {
        headers: {
          ...this.headers,
          Authorization: `tma ${authorization}`,
        },
      });

      if (checkResponse.data.code === 200) {
        if (checkResponse.data.data === 0) {
          const collectResponse = await axiosInstance.get(`${this.baseURL}/property/daily/finish?taskId=1`, {
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

  async processAllTasks(authorization, proxyUrl) {
    try {
      this.log("Đang kiểm tra và nhặt trứng hàng ngày...", "info");
      await this.collectDailyEgg(authorization, proxyUrl);
      await sleep(3);
      const taskInfo = await this.getTaskInfo(authorization, proxyUrl);
      if (!taskInfo.success) {
        this.log(`Không thể lấy thông tin nhiệm vụ: ${taskInfo.error}`, "error");
        return;
      }

      const { daily: completedDaily, oneTime: completedOneTime, partner: completedPartner } = taskInfo.data;
      const skipTask = [...completedDaily, ...completedOneTime, ...completedPartner, ...settings.SKIP_TASKS];

      const taskList = await this.getTaskList(authorization, proxyUrl);
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
      //       await this.performDailyCheckIn(authorization, proxyUrl);
      //     } else if (!completedOneTime.includes(task.taskId)) {
      //       this.log(`Đang thực hiện nhiệm vụ ${task.taskId}: ${task.content}...Đợi 5 giây...`, "info");
      //       await sleep(5);
      //       await this.completeTask(authorization, task, proxyUrl);
      //     }
      //   }
      // }

      const { daily, oneTime, partner, social_media } = taskList.data;

      if (daily && Array.isArray(daily)) {
        for (const task of daily) {
          if (task.taskId === 8 && !completedDaily.includes(8)) {
            this.log("Performing daily check-in...", "info");
            await this.performDailyCheckIn(authorization, proxyUrl);
          }
        }
      }

      if (oneTime && Array.isArray(oneTime)) {
        for (const task of oneTime) {
          if (!completedOneTime.includes(task.taskId)) {
            this.log(`Performing task: ${task.content}...`, "info");
            await this.completeTask(authorization, task, proxyUrl);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      if (partner && Array.isArray(partner)) {
        for (const task of partner) {
          if (!completedPartner.includes(task.taskId)) {
            this.log(`Performing partner task: ${task.content}...`, "info");
            await this.completeTask2(authorization, task, proxyUrl);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      this.log("Hoàn thành xử lý tất cả nhiệm vụ", "success");
    } catch (error) {
      this.log(`Lỗi khi xử lý nhiệm vụ: ${error.message}`, "error");
    }
  }

  async executeQuack(authorization, proxyUrl) {
    try {
      const axiosInstance = this.createAxiosInstance(proxyUrl);
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

        this.log(`Quack lần ${quackTimes} | Tổng ducks kiếm được: ${totalNegative} | Ducks còn lại: ${decibel}`, "custom");
        return { success: true, data: response.data.data };
      } else {
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async processQuacks(authorization, decibels, proxyUrl, maxQuackTimes = 0) {
    this.log(`Bắt đầu quack với ${decibels} ducks`, "info");
    let quackCount = 0;

    while (decibels > 0 && (maxQuackTimes === 0 || quackCount < maxQuackTimes)) {
      const result = await this.executeQuack(authorization, proxyUrl);
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

  async runAccount() {
    const i = this.accountIndex;
    const authorization = this.queryId;
    const userData = JSON.parse(decodeURIComponent(authorization.split("user=")[1].split("&")[0]));
    const firstName = userData.first_name || "";
    const lastName = userData.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();
    let maxQuackTimes = getRandomNumber(settings.AMOUNT_TAP_QUACK[0], settings.AMOUNT_TAP_QUACK[1]);
    this.session_name = userData.id;
    let proxyIP = "No proxy";
    let currentProxy = null;

    if (this.proxies[i]) {
      try {
        currentProxy = this.proxies[i];
        proxyIP = await this.checkProxyIP(currentProxy);
        this.proxyIp = proxyIP;
        this.log(`Proxy #${i + 1} hoạt động tốt | IP: ${proxyIP}`, "success");
      } catch (error) {
        this.log(`Lỗi proxy #${i + 1}: ${error.message}`, "warning");
        proxyIP = "Proxy Error";
        return;
      }
    }

    console.log(`========== Tài khoản ${i + 1} | ${fullName.green} | ip: ${proxyIP} ==========`);
    this.#set_headers();
    const waitime = getRandomNumber(settings.DELAY_START_BOT[0], settings.DELAY_START_BOT[1]);
    this.log(`Chờ ${waitime} giây trước khi chạy bot...`);
    await sleep(waitime);
    this.log(`Đang kiểm tra thông tin tài khoản...`, "info");
    const userInfo = await this.getUserInfo(authorization, currentProxy);

    if (userInfo.success) {
      this.log(`Lấy thông tin thành công!`, "success");
      await sleep(3);
      if (userInfo.data.duckName === null) {
        this.log(`Đang thiết lập tên duck...`, "info");
        const setNameResult = await this.setDuckName(authorization, fullName, currentProxy);

        if (setNameResult.success) {
          this.log(`Đặt tên duck thành công: ${setNameResult.data.duckName}`, "success");
          this.log(`Ducks: ${setNameResult.data.decibels}`, "custom");
          if (settings.AUTO_QUACK && setNameResult.data.decibels > 0) {
            await this.processQuacks(authorization, setNameResult.data.decibels, currentProxy, maxQuackTimes);
          }
        } else {
          this.log(`Không thể đặt tên duck: ${setNameResult.error}`, "error");
        }
      } else {
        this.log(`Duck name đã được thiết lập: ${userInfo.data.duckName}`, "info");
        if (userInfo.data.decibels) {
          this.log(`Ducks: ${userInfo.data.decibels}`, "custom");

          if (settings.AUTO_QUACK && userInfo.data.decibels > 0) {
            await this.processQuacks(authorization, userInfo.data.decibels, currentProxy, maxQuackTimes);
          }
        }
      }

      if (settings.AUTO_TASK) {
        this.log("Đang xử lý nhiệm vụ...", "info");
        await this.processAllTasks(authorization, currentProxy);
      }
    } else {
      this.log(`Không thể lấy thông tin tài khoản: ${userInfo.error}`, "error");
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function runWorker(workerData) {
  const { queryId, accountIndex, proxy, hasIDAPI } = workerData;
  const to = new DuckChainAPIClient(queryId, accountIndex, proxy, hasIDAPI);
  try {
    await Promise.race([to.runAccount(), new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10 * 60 * 1000))]);
    parentPort.postMessage({
      accountIndex,
    });
  } catch (error) {
    parentPort.postMessage({ accountIndex, error: error.message });
  } finally {
    if (!isMainThread) {
      parentPort.postMessage("taskComplete");
    }
  }
}

async function main() {
  const queryIds = loadData("data.txt");
  const proxies = loadData("proxy.txt");

  if (queryIds.length > proxies.length) {
    console.log("Số lượng proxy và data phải bằng nhau.".red);
    console.log(`Data: ${queryIds.length}`);
    console.log(`Proxy: ${proxies.length}`);
    process.exit(1);
  }
  console.log("Tool được phát triển bởi nhóm tele Airdrop Hunter Siêu Tốc (https://t.me/airdrophuntersieutoc)".yellow);
  let maxThreads = settings.MAX_THEADS;
  const { endpoint: hasIDAPI, message } = await checkBaseUrl();
  if (!hasIDAPI) return console.log(`Không thể tìm thấy ID API, thử lại sau!`.red);
  console.log(`${message}`.yellow);
  queryIds.map((val, i) => new DuckChainAPIClient(val, i, proxies[i], null).createUserAgent());

  await sleep(1);
  while (true) {
    let currentIndex = 0;
    const errors = [];

    while (currentIndex < queryIds.length) {
      const workerPromises = [];
      const batchSize = Math.min(maxThreads, queryIds.length - currentIndex);
      for (let i = 0; i < batchSize; i++) {
        const worker = new Worker(__filename, {
          workerData: {
            queryId: queryIds[currentIndex],
            accountIndex: currentIndex,
            proxy: proxies[currentIndex % proxies.length],
            hasIDAPI,
          },
        });

        workerPromises.push(
          new Promise((resolve) => {
            worker.on("message", (message) => {
              if (message === "taskComplete") {
                worker.terminate();
              }
              resolve();
            });
            worker.on("error", (error) => {
              console.log(`Lỗi worker cho tài khoản ${currentIndex}: ${error.message}`);
              worker.terminate();
              resolve();
            });
            worker.on("exit", (code) => {
              worker.terminate();
              if (code !== 0) {
                errors.push(`Worker cho tài khoản ${currentIndex} thoát với mã: ${code}`);
              }
              resolve();
            });
          })
        );

        currentIndex++;
      }

      await Promise.all(workerPromises);

      if (errors.length > 0) {
        errors.length = 0;
      }

      if (currentIndex < queryIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    const to = new DuckChainAPIClient(null, 0, proxies[0]);
    await sleep(3);
    // updateEnv("CLAIM_FAUCET", "false");
    await sleep(3);
    console.log("Tool được phát triển bởi nhóm tele Airdrop Hunter Siêu Tốc (https://t.me/airdrophuntersieutoc)".yellow);
    console.log(`=============Hoàn thành tất cả tài khoản=============`.magenta);
    await to.countdown(settings.TIME_SLEEP * 60 * 60);
  }
}

if (isMainThread) {
  main().catch((error) => {
    console.log("Lỗi rồi:", error);
    process.exit(1);
  });
} else {
  runWorker(workerData);
}
