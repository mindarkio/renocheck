/** Synthetic MWC / company names for offline matcher tests (no real contractors). */
export type CauseListCompanyFixture = {
  id: string;
  namesEn: string[];
  namesZh: string[];
  aliasesEn?: string[];
  aliasesZh?: string[];
};

export const CAUSE_LIST_COMPANY_FIXTURES: CauseListCompanyFixture[] = [
  {
    id: "fixture-mega-eng",
    namesEn: ["BEST MEGA ENGINEERING LIMITED"],
    namesZh: ["萬德工程有限公司"],
    aliasesEn: ["BEST MEGA ENGINEERING CO LTD"],
  },
  {
    id: "fixture-renova-hk",
    namesEn: ["SUNRISE RENOVATION (HK) LIMITED"],
    namesZh: ["旭日裝修（香港）有限公司"],
    aliasesZh: ["旭日裝修有限公司"],
  },
  {
    id: "fixture-longi",
    namesEn: ["LONGI SOLAR TECHNOLOGY LIMITED"],
    namesZh: ["隆基樂葉科技有限公司"],
    aliasesZh: ["隆基乐叶科技有限公司"],
  },
  {
    id: "fixture-demo-io",
    namesEn: ["INCORPORATED OWNERS OF OAK COURT"],
    namesZh: ["橡樹苑業主立案法團"],
  },
];
