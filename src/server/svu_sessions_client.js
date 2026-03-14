import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const SESSIONS_URL = "http://sessions.svuonline.org/new/";
const TEMP_LECTURES_DIR = path.join(os.tmpdir(), "lrec_player_lectures");

class SvuConnectionError extends Error {
  constructor(message, original = null) {
    super(message);
    this.name = 'SvuConnectionError';
    this.original = original;
  }
}

export class SvuSessionsClient {
  constructor(timeout = 60000) {
    this.timeout = timeout;
    
    // Cookie management for ASP.NET Sessions
    const jar = new CookieJar();
    this.client = wrapper(axios.create({
      jar,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Referer": SESSIONS_URL,
      }
    }));

    this._state = {
      view_state: "",
      view_state_generator: "",
      event_validation: "",
      view_state_encrypted: "",
    };

    this._selections = this._defaultSelections();
    this._currentHtml = "";
  }

  _defaultSelections() {
    return {
      "DropDownList_Term": "0",
      "DropDownList_Program": "0",
      "DropDownList_Course": "0",
      "DropDownList_Tutor": "0",
      "DropDownList_Class": "0",
    };
  }

  _soup() {
    return cheerio.load(this._currentHtml);
  }

  _extractStateParams(html) {
    const $ = cheerio.load(html);
    return {
      view_state: $("#__VIEWSTATE").val() || "",
      view_state_generator: $("#__VIEWSTATEGENERATOR").val() || "",
      event_validation: $("#__EVENTVALIDATION").val() || "",
      view_state_encrypted: $("#__VIEWSTATEENCRYPTED").val() || "",
    };
  }

  _parseDropdownOptions(dropdownId) {
    const $ = this._soup();
    const select = $(`#${dropdownId}`);
    if (!select.length) return [];

    const options = [];
    select.find('option').each((_, el) => {
      const value = $(el).attr('value')?.trim();
      const text = $(el).text()?.trim();
      if (value && value !== "0") {
        options.push({ value, text });
      }
    });
    return options;
  }

  _parseSessions(courseId) {
    const $ = this._soup();
    const table = $("#GridView_results");
    if (!table.length) return [];

    const sessions = [];
    table.find('tr').each((index, el) => {
      if (index === 0) return; // skip header row
      const cells = $(el).find('td');
      if (cells.length < 8) return;

      const anchor = $(cells[0]).find('a');
      const href = anchor.attr('href') || "";
      const match = href.match(/__doPostBack\('GridView_results','([^']+)'\)/);
      if (!match) return;

      sessions.push({
        id: `${courseId}_session_${index}`,
        course_id: courseId,
        event_argument: match[1],
        program: $(cells[1]).text().trim(),
        course_name: $(cells[2]).text().trim(),
        class_name: $(cells[3]).text().trim(),
        term: $(cells[4]).text().trim(),
        order: $(cells[5]).text().trim(),
        tutor: $(cells[6]).text().trim(),
        date: $(cells[7]).text().trim(),
        links: []
      });
    });
    return sessions;
  }

  _parseDownloadLinks(sessionId) {
    const $ = this._soup();
    const table = $("#GridView1");
    if (!table.length) return [];

    const links = [];
    table.find('tr').each((index, el) => {
      if (index === 0) return; // skip header
      const cells = $(el).find('td');
      if (cells.length < 4) return;

      const anchor = $(cells[0]).find('a');
      const href = anchor.attr('href')?.trim() || "";
      if (!href || href === "N/A") return;

      let filename = path.basename(decodeURIComponent(new URL(href, SESSIONS_URL).pathname));
      if (!filename) filename = `${sessionId}.lrec`;
      filename = filename.replace(/[<>:"/\\|?*]+/g, '_');

      links.push({
        id: `${sessionId}_link_${index}`,
        session_id: sessionId,
        description: $(cells[1]).text().trim(),
        link: new URL(href, SESSIONS_URL).toString(),
        size_mb: $(cells[3]).text().trim(),
        filename: filename
      });
    });
    return links;
  }

  async _makePostRequest(eventTarget, eventArgument = "") {
    const params = new URLSearchParams();
    params.append("__EVENTTARGET", eventTarget);
    params.append("__EVENTARGUMENT", eventArgument);
    params.append("__LASTFOCUS", "");
    params.append("__VIEWSTATE", this._state.view_state);
    params.append("__VIEWSTATEGENERATOR", this._state.view_state_generator);
    params.append("__EVENTVALIDATION", this._state.event_validation);
    params.append("__VIEWSTATEENCRYPTED", this._state.view_state_encrypted);

    for (const [key, value] of Object.entries(this._selections)) {
      params.append(key, value);
    }

    try {
      const response = await this.client.post(SESSIONS_URL, params.toString());
      this._currentHtml = response.data;
      this._state = this._extractStateParams(this._currentHtml);
    } catch (error) {
      throw new SvuConnectionError(`POST Request failed: ${error.message}`, error);
    }
  }

  async initialize() {
    try {
      const response = await this.client.get(SESSIONS_URL);
      this._currentHtml = response.data;
      this._state = this._extractStateParams(this._currentHtml);
      this._selections = this._defaultSelections();
      return this._parseDropdownOptions("DropDownList_Term");
    } catch (error) {
      throw new SvuConnectionError(`Initialization failed: ${error.message}`, error);
    }
  }

  async selectTerm(termValue) {
    this._selections["DropDownList_Term"] = termValue;
    this._selections["DropDownList_Program"] = "0";
    this._selections["DropDownList_Course"] = "0";
    this._selections["DropDownList_Tutor"] = "0";
    this._selections["DropDownList_Class"] = "0";
    await this._makePostRequest("DropDownList_Term");
    return this._parseDropdownOptions("DropDownList_Program");
  }

  async selectProgram(programValue) {
    this._selections["DropDownList_Program"] = programValue;
    this._selections["DropDownList_Course"] = "0";
    this._selections["DropDownList_Tutor"] = "0";
    this._selections["DropDownList_Class"] = "0";
    await this._makePostRequest("DropDownList_Program");
    return this._parseDropdownOptions("DropDownList_Course");
  }

  async selectCourse(courseValue) {
    this._selections["DropDownList_Course"] = courseValue;
    this._selections["DropDownList_Tutor"] = "0";
    this._selections["DropDownList_Class"] = "0";
    await this._makePostRequest("DropDownList_Course");
    return this._parseDropdownOptions("DropDownList_Tutor");
  }

  async selectTutor(tutorValue) {
    this._selections["DropDownList_Tutor"] = tutorValue;
    this._selections["DropDownList_Class"] = "0";
    await this._makePostRequest("DropDownList_Tutor");
    return this._parseDropdownOptions("DropDownList_Class");
  }

  async selectClass(classValue, courseId) {
    this._selections["DropDownList_Class"] = classValue;
    await this._makePostRequest("DropDownList_Class");
    return this._parseSessions(courseId);
  }

  async restoreState(term, program = null, course = null, tutor = null, classVal = null) {
    // Check if we actually need to rebuild
    if (
      this._selections["DropDownList_Term"] === term &&
      (!program || this._selections["DropDownList_Program"] === program) &&
      (!course || this._selections["DropDownList_Course"] === course) &&
      (!tutor || this._selections["DropDownList_Tutor"] === tutor) &&
      (!classVal || this._selections["DropDownList_Class"] === classVal) &&
      this._state.view_state // Ensure we have a valid viewstate
    ) {
      return; 
    }

    console.log(`Restoring state: Term=${term}, Prog=${program}, Course=${course}...`);
    // Rebuild sequentially
    await this.initialize();
    if (term) await this.selectTerm(term);
    if (program) await this.selectProgram(program);
    if (course) await this.selectCourse(course);
    if (tutor) await this.selectTutor(tutor);
    if (classVal) await this.selectClass(classVal, course); 
  }

  async fetchSessionLinks(sessionInfo) {
    await this._makePostRequest("GridView_results", sessionInfo.event_argument);
    return this._parseDownloadLinks(sessionInfo.id);
  }

  /**
   * Downloads a lecture using streaming and resolves the final path.
   */
  async downloadLecture(downloadLink, destination = null, progressCallback = null, overwrite = false) {
    let cacheDir = destination ? path.dirname(destination) : TEMP_LECTURES_DIR;
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const outputPath = destination || path.join(cacheDir, downloadLink.filename);
    
    if (!overwrite && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      if (progressCallback) {
        const size = fs.statSync(outputPath).size;
        progressCallback(size, size);
      }
      return outputPath;
    }

    const tempPath = `${outputPath}.part`;
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    try {
      const response = await this.client({
        method: 'get',
        url: downloadLink.link,
        responseType: 'stream'
      });

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let writtenBytes = 0;

      const writer = fs.createWriteStream(tempPath);
      
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          writtenBytes += chunk.length;
          if (progressCallback) progressCallback(writtenBytes, totalBytes);
        });
        
        response.data.pipe(writer);

        writer.on('finish', () => {
          fs.renameSync(tempPath, outputPath);
          resolve(outputPath);
        });

        writer.on('error', (err) => {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          reject(new SvuConnectionError(`File writing failed: ${err.message}`));
        });
      });
    } catch (e) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      throw new SvuConnectionError(`Download failed: ${e.message}`, e);
    }
  }
}

// Simple CLI test execution
const isMainModule = import.meta.url.startsWith('file:') && process.argv[1] && import.meta.url.includes(path.basename(process.argv[1]));
if (isMainModule) {
  (async () => {
    console.log("Testing Node.js SVU Sessions Client...");
    const client = new SvuSessionsClient();
    try {
      const terms = await client.initialize();
      console.log(`Found ${terms.length} terms.`);
      if (terms.length > 0) {
        console.log("Select First Term:", terms[0].text);
        const programs = await client.selectTerm(terms[0].value);
        console.log(`Found ${programs.length} programs.`);
      }
    } catch(e) {
      console.error(e);
    }
  })();
}
