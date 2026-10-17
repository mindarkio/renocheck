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
    namesEn: ["FICTIVE MEGA ENGINEERING LIMITED"],
    namesZh: ["示例工程有限公司"],
    aliasesEn: ["FICTIVE MEGA ENGINEERING CO LTD"],
    aliasesZh: ["示例工程（香港）有限公司"],
  },
  {
    id: "fixture-renova-hk",
    namesEn: ["FICTIVE RENOVATION (HK) LIMITED"],
    namesZh: ["示例裝修（香港）有限公司"],
    aliasesZh: ["示例裝修有限公司"],
  },
  {
    id: "fixture-solar-tech",
    namesEn: ["FICTIVE SOLAR TECHNOLOGY LIMITED"],
    namesZh: ["示例光伏科技有限公司"],
    aliasesZh: ["示例光伏科技有限公司"],
  },
  {
    id: "fixture-demo-io",
    namesEn: ["INCORPORATED OWNERS OF SYNTHETIC COURT"],
    namesZh: ["示例苑業主立案法團"],
  },
];
