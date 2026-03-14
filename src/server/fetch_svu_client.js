import * as cheerio from 'cheerio';

const SESSIONS_URL = "http://sessions.svuonline.org/new/";

export class FetchSvuClient {
  constructor() {
    this.cookies = new Map();
    this._state = {
      view_state: "",
      view_state_generator: "",
      event_validation: "",
      view_state_encrypted: "",
    };
    this._selections = {
      "DropDownList_Term": "0",
      "DropDownList_Program": "0",
      "DropDownList_Course": "0",
      "DropDownList_Tutor": "0",
      "DropDownList_Class": "0",
    };
    this.lastHtml = "";
  }

  _getCookieString() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  _updateCookies(header) {
    if (!header) return;
    // In many environments, header can be a comma-separated string or an array
    const parts = Array.isArray(header) ? header : header.split(/,(?=[^;]*=)/);
    
    parts.forEach(c => {
      const cookiePart = c.trim().split(';')[0];
      const eqIdx = cookiePart.indexOf('=');
      if (eqIdx > 0) {
        const name = cookiePart.substring(0, eqIdx).trim();
        const value = cookiePart.substring(eqIdx + 1).trim();
        if (name) this.cookies.set(name, value);
      }
    });
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

  async _request(method, url, body = null) {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": SESSIONS_URL,
    };

    const cookieStr = this._getCookieString();
    if (cookieStr) headers["Cookie"] = cookieStr;

    const options = { method, headers };
    if (body) {
      options.body = body;
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const res = await fetch(url, options);
    this._updateCookies(res.headers.get("Set-Cookie"));
    
    this.lastHtml = await res.text();
    this._state = this._extractStateParams(this.lastHtml);
    return this.lastHtml;
  }

  async initialize() {
    await this._request("GET", SESSIONS_URL);
    return this._parseDropdownOptions("DropDownList_Term");
  }

  _parseDropdownOptions(dropdownId) {
    const $ = cheerio.load(this.lastHtml);
    const options = [];
    $(`#${dropdownId} option`).each((_, el) => {
      const value = $(el).attr('value')?.trim();
      const text = $(el).text()?.trim();
      if (value && value !== "0") options.push({ value, text });
    });
    return options;
  }

  async selectTerm(val) {
    this._selections["DropDownList_Term"] = val;
    this._selections["DropDownList_Program"] = "0";
    await this._makePostRequest("DropDownList_Term");
    return this._parseDropdownOptions("DropDownList_Program");
  }

  async selectProgram(val) {
    this._selections["DropDownList_Program"] = val;
    this._selections["DropDownList_Course"] = "0";
    await this._makePostRequest("DropDownList_Program");
    return this._parseDropdownOptions("DropDownList_Course");
  }

  async selectCourse(val) {
    this._selections["DropDownList_Course"] = val;
    this._selections["DropDownList_Tutor"] = "0";
    await this._makePostRequest("DropDownList_Course");
    return this._parseDropdownOptions("DropDownList_Tutor");
  }

  async selectTutor(val) {
    this._selections["DropDownList_Tutor"] = val;
    this._selections["DropDownList_Class"] = "0";
    await this._makePostRequest("DropDownList_Tutor");
    return this._parseDropdownOptions("DropDownList_Class");
  }

  async selectClass(val, courseId) {
    this._selections["DropDownList_Class"] = val;
    await this._makePostRequest("DropDownList_Class");
    return this._parseSessions(courseId);
  }

  async fetchSessionLinks(sessionInfo) {
    await this._makePostRequest("GridView_results", sessionInfo.event_argument);
    return this._parseDownloadLinks(sessionInfo.id);
  }

  async _makePostRequest(target, argument = "") {
    const params = new URLSearchParams();
    params.append("__EVENTTARGET", target);
    params.append("__EVENTARGUMENT", argument);
    params.append("__VIEWSTATE", this._state.view_state);
    params.append("__VIEWSTATEGENERATOR", this._state.view_state_generator);
    params.append("__EVENTVALIDATION", this._state.event_validation);
    params.append("__VIEWSTATEENCRYPTED", this._state.view_state_encrypted);

    for (const [key, value] of Object.entries(this._selections)) {
      params.append(key, value);
    }

    return await this._request("POST", SESSIONS_URL, params.toString());
  }

  _parseSessions(courseId) {
    const $ = cheerio.load(this.lastHtml);
    const sessions = [];
    $("#GridView_results tr").each((i, el) => {
      if (i === 0) return;
      const cells = $(el).find('td');
      const anchor = $(cells[0]).find('a');
      const href = anchor.attr('href') || "";
      const match = href.match(/__doPostBack\('GridView_results','([^']+)'\)/);
      if (!match) return;

      sessions.push({
        id: `${courseId}_session_${i}`,
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
    const $ = cheerio.load(this.lastHtml);
    const links = [];
    $("#GridView1 tr").each((i, el) => {
      if (i === 0) return;
      const cells = $(el).find('td');
      const anchor = $(cells[0]).find('a');
      const href = anchor.attr('href')?.trim();
      if (!href || href === "N/A") return;

      links.push({
        id: `${sessionId}_link_${i}`,
        description: $(cells[1]).text().trim(),
        link: new URL(href, SESSIONS_URL).toString(),
        filename: href.split('/').pop() || `${sessionId}.lrec`
      });
    });
    return links;
  }

  async restoreState(term, program, course, tutor, classVal) {
    await this.initialize();
    if (term) await this.selectTerm(term);
    if (program) await this.selectProgram(program);
    if (course) await this.selectCourse(course);
    if (tutor) await this.selectTutor(tutor);
    if (classVal) await this.selectClass(classVal, course);
  }
}
