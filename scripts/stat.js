
/**
 * before:data hook
 * @param {*} params
 * @returns
 */
function BeforeData(params) {
 log.Info("[chart] before data hook: %s", JSON.stringify(params));
 return [params];
}
   
/**
 * after:data hook
 * @param {*} data
 * @returns
 */
function AfterData(data) {
 log.Info("[chart] after data hook: %s", JSON.stringify(data));
 return data;
}
   
/**
 * Get Data
 * @param {*} params
 */
function Data(params) {
 log.Info("[chart] process data query: %s", JSON.stringify(params));
 return {
   income: [
	 { value: 40300, date: "2022-1-1" },
	 { value: 50800, date: "2022-2-1" },
	 { value: 31300, date: "2022-3-1" },
	 { value: 48800, date: "2022-4-1" },
	 { value: 69900, date: "2022-5-1" },
	 { value: 37800, date: "2022-6-1" },
   ],
   cost: [
	 { value: 28100, date: "2022-1-1" },
	 { value: 23000, date: "2022-2-1" },
	 { value: 29300, date: "2022-3-1" },
	 { value: 26700, date: "2022-4-1" },
	 { value: 26400, date: "2022-5-1" },
	 { value: 31200, date: "2022-6-1" },
   ],
   rate: [
	 { value: 8.0, date: "2022-1-1" },
	 { value: 7.6, date: "2022-2-1" },
	 { value: 9.1, date: "2022-3-1" },
	 { value: 8.4, date: "2022-4-1" },
	 { value: 6.9, date: "2022-5-1" },
	 { value: 9.0, date: "2022-6-1" },
   ],
   pet_count: 54,
   pet_type: 8,
   income_monthly: 68900,
   doctor_count: 23,
   prev_pet_count: { current: 54, prev: 45 },
   prev_pet_type: { current: 8, prev: 13 },
   prev_income_monthly: { current: 68900, prev: 92000 },
   prev_doctor_count: { current: 23, prev: 27 },
   datasource_type: [
	 { type: "猫猫", count: 18 },
	 { type: "狗狗", count: 6 },
	 { type: "其他", count: 3 },
   ],
   datasource_status: [
	 { status: "已查看", count: 3 },
	 { status: "治疗中", count: 12 },
	 { status: "已治愈", count: 9 },
   ],
   datasource_cost: [
	 { name: "毛毛", stay: 3, cost: 2000 },
	 { name: "阿布", stay: 6, cost: 4200 },
	 { name: "咪咪", stay: 7, cost: 6000 },
	 { name: "狗蛋", stay: 1, cost: 1000 },
   ],
 };
}

/**
 * Compute out
 * @param {*} field
 * @param {*} value
 * @param {*} data
 * @returns
 */
function Income(field, value, data) {
 log.Info(
   "[chart] Income Compute: %s",
   JSON.stringify({ field: field, value: value, data: data })
 );
 return value;
}   
	