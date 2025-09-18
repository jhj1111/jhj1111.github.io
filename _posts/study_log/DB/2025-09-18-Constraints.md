---
title: (DB) 7. 무결성 제약사항
post_order: 7
thumbnail: https://cdn.educba.com/academy/wp-content/uploads/2019/10/SQL-Constraints.png
layout: post
author: jhj
categories:
  - StudyLog
  - DB
tags:
  - DB
  - Constraints
  - command
excerpt: sql 데이터 조건
project_rank: "680"
sticker: emoji//1 f 4 aa
---



# 무결성

> 무효갱신으로 부터 테이블내의 데이터를 위/변조,훼손하지 못하도록 제약(Constraint)하여 데이터의 유효성, 일관성, 완전성,정확성,정밀성을 보장하는 성질
> 
- 무결성 제약사항 구현 방법 3가지
    - 선언적 무결성 제약사항(Declarative Integrity Constraint)
    - Trigger (PL/SQL)
    - Application Logic (Coding)

# 선언적 무결성 제악사항

> 코딩으로 실행하는 것이 아닌 테이블 생성시 혹은 생성 후 제약사항을 표기하여 정의
> 
- 코딩으로 실행하는 것이 아닌 테이블 정의 및 설정(ALTER)으로 선언
- dictionary 형태로 별도 저장
- 종류
    - PRIMARY KEY
    - UNIQUE KEY
    - CHECK
    - NOT NULL
    - FOREIGN KEY

## NOT NULL

> **데이터**가 반드시 **존재**하고, **NULL**을 **허용하지 않는** 제약 사항
> 
- 조건을 위반하는 데이터 생성, 변경 → error
- 테이블 생성

```sql
CREATE TABLE CUSTOMER_TEST(
	ID   VARCHAR2(8) NOT NULL,
	PWD  VARCHAR2(8) CONSTRAINT CUSTOMER_PWD_NN NOT NULL,
	NAME VARCHAR2(20), --이름
	SEX  CHAR(1),      --성별[M|F] M:MaleF: Female
	AGE  NUMBER(3)     --나이
);

DESC CUSTOMER_TEST

Table CUSTOMER_TEST이(가) 생성되었습니다.

이름   널?       유형           
---- -------- ------------ 
ID   NOT NULL VARCHAR2(8)  
PWD  NOT NULL VARCHAR2(8)  
NAME          VARCHAR2(20) 
SEX           CHAR(1)      
AGE           NUMBER(3)    

```

- 예상하지 못한 데이터 입력 가능성
    - 오류는 아니지만 의도한 형식과 다른 데이터
    - 'xman', 'XMAN'(대소문자), 'T'('M'나'F'가 아님)

```sql
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,SEX, AGE) VALUES('xman','ok','kang', 'M',21);
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,SEX,AGE) VALUES('XMAN','no','kim', 'T',-20);
-- 정상적 입력
```

- NOT NULL에 암시적, 명시적 NULL data 삽입
    - error("cannot update (%s) to NULL")

```sql
INSERT INTO CUSTOMER_TEST(ID,NAME,AGE) VALUES('zman','son',99);
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,AGE) VALUES('rman',NULL,'jjang',24);
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,AGE) VALUES('', 'pwd' ,'jjang',24);
/*
PWD,SEX 컬럼에 암시적/명시적NULL을 삽입하려 하지만
PWD컬럼의NOT NULL 제약사항으로INSERT는 에러 발생.
DML 연산시 데이터를 변경함에 따라부적절한 데이터가 발생할수 있다.
DML 연산으로 데이터를 변경 하기전에 무결성 제약사항을 위반하는지 여부를 점검한후
무결성 제약사항을 위반하게 되면 해당DML 연산을 수행하지 않고 취소 처리.
*/

명령의 1 행에서 시작하는 중 오류 발생 -
INSERT INTO CUSTOMER_TEST(ID,NAME,AGE) VALUES('zman','son',99)
오류 보고 -
ORA-01400: NULL을 ("SCOTT"."CUSTOMER_TEST"."PWD") 안에 삽입할 수 없습니다

명령의 2 행에서 시작하는 중 오류 발생 -
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,AGE) VALUES('rman',NULL,'jjang',24)
오류 발생 명령행: 2 열: 58
오류 보고 -
SQL 오류: ORA-01400: NULL을 ("SCOTT"."CUSTOMER_TEST"."PWD") 안에 삽입할 수 없습니다
01400. 00000 -  "cannot insert NULL into (%s)"
*Cause:    An attempt was made to insert NULL into previously listed objects.
*Action:   These objects cannot accept NULL values.

명령의 3 행에서 시작하는 중 오류 발생 -
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,AGE) VALUES('', 'pwd' ,'jjang',24)
오류 발생 명령행: 3 열: 51
오류 보고 -
SQL 오류: ORA-01400: NULL을 ("SCOTT"."CUSTOMER_TEST"."ID") 안에 삽입할 수 없습니다
01400. 00000 -  "cannot insert NULL into (%s)"
*Cause:    An attempt was made to insert NULL into previously listed objects.
*Action:   These objects cannot accept NULL values.
```

```sql
UPDATE CUSTOMER_TEST SET PWD = NULL WHERE ID = 'XMAN'; --ID가XMAN인ROW만 수정
SELECT * FROM CUSTOMER;
-- UPDATE연산은PWD의NOT NULL 제약사항으로 에러가 발생

명령의 1 행에서 시작하는 중 오류 발생 -
UPDATE CUSTOMER_TEST SET PWD = NULL WHERE ID = 'XMAN'
오류 발생 명령행: 1 열: 26
오류 보고 -
SQL 오류: ORA-01407: NULL로 ("SCOTT"."CUSTOMER_TEST"."PWD")을 업데이트할 수 없습니다
01407. 00000 -  "cannot update (%s) to NULL"
*Cause:    
*Action:

ID       PWD      NAME                 S        AGE
-------- -------- -------------------- - ----------
xman     ok       kang                 M         21
XMAN     no       kim                  T        -20
```

- USER 데이터가 아닌 SYSTEM data, catalog TABLE
    - `DBA_` : DBMS 내의 모든 권한 및 정보
    - `ALL_` : 접근(access) 가능한 모든 권한 및 정보
    - `USER_` : 내 소유의 모든 권한 및 정보
    - ex) `...S`, `USER_CONSTRAINTS`, `USER_TABLES`, …

```sql
// 데이터딕셔너리(시스템 카타로그)에서 제약사항 확인하기
SELECT TABLE_NAME,CONSTRAINT_NAME,CONSTRAINT_TYPE,SEARCH_CONDITION
FROM USER_CONSTRAINTS
WHERE TABLE_NAME = 'CUSTOMER_TEST';

SELECT TABLE_NAME,CONSTRAINT_NAME,POSITION,COLUMN_NAME
FROM USER_CONS_COLUMNS
WHERE TABLE_NAME = 'CUSTOMER_TEST' ORDER BY CONSTRAINT_NAME,POSITION;
```

![image.png](/assets/images/study_log/DB/2025-09-18-Constraints/image.png)

![image.png](/assets/images/study_log/DB/2025-09-18-Constraints/image%201.png)

## CHECK

> 설정된 조건 → TRUE, FALSE
TABLE 구조 변경 시 제약사항 추가 및 참고
> 
- 이미 생성된 기존 data에 영향을 받음
    - SEX = (’M’, ‘F’, ‘T’, …) → 오류

```sql
//테이블 생성후 제약사항 추가
ALTER TABLE CUSTOMER_TEST ADD CONSTRAINT CUSTOMER_SEX_CK CHECK (SEX IN ('M','F'));
-- SQL 오류: ORA-02293: (SCOTT.CUSTOMER_SEX_CK)을 검증할 수 없습니다
-- 잘못된 제약사항 확인
-- 이미 다른 data 존재

명령의 1 행에서 시작하는 중 오류 발생 -
ALTER TABLE CUSTOMER_TEST ADD CONSTRAINT CUSTOMER_SEX_CK CHECK (SEX IN ('M','F'))
오류 보고 -
ORA-02293: (SCOTT.CUSTOMER_SEX_CK)을 검증할 수 없습니다 - 잘못된 제약을 확인합니다
02293. 00000 - "cannot validate (%s.%s) - check constraint violated"
*Cause:    an alter table operation tried to validate a check constraint to
           populated table that had nocomplying values.
*Action:   Obvious
```

- NULL 비교 불가
    - CHECK 제악사항 탐지X

```sql
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,AGE) VALUES('asura','ok', 'joo',99);
-- 성별(SEX) 컬럼에 NOT NULL 제약사항이 없기 때문에 NULL 입력.

1 행 이(가) 삽입되었습니다.
```

- 제약조건을 위반하는 모든 동작 취소

```sql
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,SEX,AGE) VALUES('harisu','ok', 'susu','T',33);
-- 성별(SEX) 컬럼에 Check 제약사항으로 M 과 F만 입력 가능 에러발생

명령의 1 행에서 시작하는 중 오류 발생 -
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,SEX,AGE) VALUES('harisu','ok', 'susu','T',33)
오류 보고 -
ORA-02290: 체크 제약조건(SCOTT.CUSTOMER_SEX_CK)이 위배되었습니다
```

```sql
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,SEX, AGE) VALUES('xman','ok','kang', 'M',21);
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,SEX,AGE) VALUES('xman','ok', 'jjang','M',20);
-- ID가 중복되지만 입력
```

```sql
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,SEX,AGE) VALUES('shinsun','ok', '도사', 'M',999);
-- AGE컬럼은 NUMBER(3)으로 정의되어 999가 입력된다..

UPDATE CUSTOMER_TEST SET AGE = AGE + 1;
-- 1년이 지나 고객의 나이를 +1 하려고 UPDATE 연산을 수행하는데 
--회원 shisun은 1000으로 자리수를 초과하는 에러가 발생하여 
-- 문장 수준 롤백(Statement Level Rollback) 발생.

명령의 4 행에서 시작하는 중 오류 발생 -
UPDATE CUSTOMER_TEST SET AGE = AGE + 1
오류 발생 명령행: 4 열: 36
오류 보고 -
SQL 오류: ORA-01438: 이 열에 대해 지정된 전체 자릿수보다 큰 값이 허용됩니다.
01438. 00000 -  "value larger than specified precision allowed for this column"
*Cause:    When inserting or updating records, a numeric value was entered
           that exceeded the precision defined for the column.
*Action:   Enter a value that complies with the numeric column's precision,
           or use the MODIFY option with the ALTER TABLE command to expand
           the precision.
```

## Unique Key

> 컬럼 데이터의 고유성을 보장하고 NULL을 허용하여 데이터가 없을수 있지만 데이터가 존재하는
경우 고유해야 한다.
> 
- TABLE 당 **N개 생성 가능**
- `... (DEFAULT [data]) CONSTRAINT [constraint_name] UNIQUE (CHECK ...) ...`
    - `[constraint_name]` 생략 가능
- UNIQUE data 중복 발생 시 error
- UNIQUE Key 생성 → UNIQUE Index 생성
    - 동일 데이터 탐지
    - 배열 탐색 기반 → 속도 빠름
    - `..._IND_...` : index 관련 설정
- NULL과 UNIQUE

```sql
DROP TABLE CUSTOMER_TEST;

CREATE TABLE CUSTOMER_TEST(
	ID VARCHAR2(8) NOT NULL CONSTRAINT CUSTOMER_ID_UK UNIQUE,
	PWD VARCHAR2(8) NOT NULL,
	NAME VARCHAR2(20),
	SEX CHAR(1) DEFAULT 'M'
		CONSTRAINT CUSTOMER_SEX_CK CHECK (SEX IN ('M','F')),
	MOBILE VARCHAR2(14) UNIQUE,
	AGE NUMBER(3) DEFAULT 18
);

DESC TEST

이름     널?       유형           
------ -------- ------------ 
ID     NOT NULL VARCHAR2(8)  
PWD    NOT NULL VARCHAR2(8)  
NAME            VARCHAR2(20) 
SEX             CHAR(1)      
MOBILE          VARCHAR2(14) 
AGE             NUMBER(3) 
```

```sql
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME,MOBILE, AGE) 
VALUES('xman','ok','kang', '011-3333',21);
-- 성별 컬럼에 암시적으로NULL이 지정되지만DEFAULT에 의해서 'M' 값이 저장된다.

INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, MOBILE,AGE) 
VALUES('XMAN','yes','kim','011-3334',33);
-- 데이터는 대소문자를 구분하기 때문에xman과 XMAN은다른 데이터
```

---

```sql
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, MOBILE,AGE) 
VALUES('xman','yes','lee', '011-3335',-21);
-- ID중복으로Unique 제약 사항 위반 에러 발생INSERT 실패(회원가입 실패)

INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, MOBILE,AGE) 
VALUES('yman','yes','lee', '011-3333',28);
-- 헨드폰 번호 중복으로 Unique 제약 사항 위반 에러 발생INSERT 실패(회원가입 실패)

명령의 24 행에서 시작하는 중 오류 발생 -
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, MOBILE,AGE) 
VALUES('xman','yes','lee', '011-3335',-21)
오류 보고 -
ORA-00001: 무결성 제약 조건(SCOTT.CUSTOMER_ID_UK)에 위배됩니다

명령의 28 행에서 시작하는 중 오류 발생 -
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, MOBILE,AGE) 
VALUES('yman','yes','lee', '011-3333',28)
오류 보고 -
ORA-00001: 무결성 제약 조건(SCOTT.SYS_C007955)에 위배됩니다
```

```sql
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, MOBILE) 
VALUES('무명인','yes',NULL, NULL);
-- ID컬럼의NOT NULL 제약사항으로NULL을 허용하지 않는다.

명령의 32 행에서 시작하는 중 오류 발생 -
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, MOBILE) 
VALUES('무명인','yes',NULL, NULL)
오류 발생 명령행: 33 열: 8
오류 보고 -
SQL 오류: ORA-12899: "SCOTT"."CUSTOMER_TEST"."ID" 열에 대한 값이 너무 큼(실제: 9, 최대값: 8)
12899. 00000 -  "value too large for column %s (actual: %s, maximum: %s)"
*Cause:    An attempt was made to insert or update a column with a value
           which is too wide for the width of the destination column.
           The name of the column is given, along with the actual width
           of the value, and the maximum allowed width of the column.
           Note that widths are reported in characters if character length
           semantics are in effect for the column, otherwise widths are
           reported in bytes.
*Action:   Examine the SQL statement for correctness.  Check source
           and destination column data types.
           Either make the destination column wider, or use a subset
           of the source column (i.e. use substring).
```

- 제악사항 조합 가능

```sql
ALTER TABLE CUSTOMER_TEST ADD CONSTRAINT CUSTOMER_NAME_SEX_UK UNIQUE(NAME,SEX);
ALTER TABLE CUSTOMER_TEST MODIFY(NAME NOT NULL);
-- 테이블 생성후 제약사항 신규 추가
-- 2개 컬럼을 조합하여Unique제약 사항을 생성

Table CUSTOMER_TEST이(가) 변경되었습니다.

Table CUSTOMER_TEST이(가) 변경되었습니다.
```

```sql
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, SEX) 
VALUES('rman','yes','syo', 'M');

INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, SEX ) 
VALUES('Rman','yes','syo', 'F');

INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, SEX) 
VALUES('RmaN','yes','syo', 'M'); -- ('syo', 'M') 조합 위반

1 행 이(가) 삽입되었습니다.

1 행 이(가) 삽입되었습니다.

명령의 48 행에서 시작하는 중 오류 발생 -
INSERT INTO CUSTOMER_TEST(ID,PWD,NAME, SEX) 
VALUES('RmaN','yes','syo', 'M')
오류 보고 -
ORA-00001: 무결성 제약 조건(SCOTT.CUSTOMER_NAME_SEX_UK)에 위배됩니다
```

```sql
SELECT * FROM CUSTOMER_TEST;
-- NAME+SEX 조합의Unique 제약사항

ID       PWD      NAME                 S MOBILE                AGE
-------- -------- -------------------- - -------------- ----------
xman     ok       kang                 M 011-3333               21
XMAN     yes      kim                  M 011-3334               33
rman     yes      syo                  M                        18
Rman     yes      syo                  F                        18
```

```sql
// INDEX 생성 여부 확인
SELECT INDEX_NAME,INDEX_TYPE,UNIQUENESS FROM USER_INDEXES
WHERE TABLE_NAME = 'CUSTOMER';

SELECT INDEX_NAME,COLUMN_POSITION,COLUMN_NAME FROM USER_IND_COLUMNS
WHERE TABLE_NAME = 'CUSTOMER' ORDER BY INDEX_NAME,COLUMN_POSITION;
/*
[참고] UNIQUE 제약사항 정의시 해당 컬럼에INDEX 가 자동 생성된다.
INDEX는Data에 대한 빠른 접근(Quick Search)를 할수 있도록 하는 
데이터베이스 Object로 Unique 제약사항 정의시 Index 자동 생성되는 이유는 
데이터 입력,수정시 중복 여부를 빠르게 확인하기 위해서 생성.
*/
```

![image.png](/assets/images/study_log/DB/2025-09-18-Constraints/image%202.png)

![image.png](/assets/images/study_log/DB/2025-09-18-Constraints/image%203.png)

## Primary Key

> 테이블내의 각 레코드(행)을 고유하게 식별하는 값을 가진 컬럼(들)의 조합으로
컬럼 데이터의 고유성(Uniqueness) 과 존재성(Not Null)을 동시에 보장하는 제약사항.
> 
- TABLE 당 1개만 정의
- UNIQUE KEY + NOT NULL
    - 고유성 + 존재성(반드시 존재해야 하는 data)

```sql
DROP TABLE CUSTOMER_TEST;

CREATE TABLE CUSTOMER_TEST(
	ID VARCHAR2(8) CONSTRAINT CUSTOMER_ID_PK PRIMARY KEY,
	PWD VARCHAR2(8) NOT NULL,
	NAME VARCHAR2(20),
	SEX CHAR(1) DEFAULT 'M'
		CONSTRAINT CUSTOMER_SEX_CK CHECK (SEX IN ('M','F')),
	MOBILE VARCHAR2(14)CONSTRAINT CUSTOMER_MOBILE_UK UNIQUE,
	AGE NUMBER(3) DEFAULT 18
);

DESC CUSTOMER_TEST
```

```sql
성별(SEX),나이(AGE) 컬럼에 정의된 DEFAULT는입력시 컬럼의 값이 지정되지 않는 암시적인NULL이 지정되면
NULL 대신 저장하는 값으로 성별에는'M', 나이는18 입력
INSERT INTO CUSTOMER(ID,PWD,NAME,MOBILE) VALUES('zman','ok','한국', '011');
③MOBILE 컬럼에는UNIQUE KEY 제약사항이 정의되었지만NULL 허용.
INSERT INTO CUSTOMER(ID,PWD,NAME) VALUES('xman','ok','king');
④ID중복으로 에러가 발생한다.
SQL 오류: ORA-00001: 무결성 제약 조건(SCOTT.CUSTOMER_ID_PK)에 위배됩니다
0001. 00000 -"unique constraint (%s.%s) violated"
INSERT INTO CUSTOMER(ID,PWD,NAME) VALUES('xman','power','zzang');
⑤데이터는 대소문자를 구분한다.
'xman' 와 'Xman'은 다른 데이터로 중복 에러가 발생하지않는다.
INSERT INTO CUSTOMER(ID,PWD,NAME) VALUES('Xman','korea','dbzzang');
⑥VALUES절에 함수 사용 가능하다, ID 중복으로 무결성 위반 에러 발생
INSERT INTO CUSTOMER(ID,PWD,NAME) VALUES(lower('xMan'),'ok','zzang');
⑦INSERT시 컬럼 생략시 해당 컬럼에 암시적NULL이 지정된다.
PRIMARY KEY는NULL을 허용하지 않는다.
SQL 오류: ORA-01400: NULL을("SCOTT"."CUSTOMER"."ID") 안에 삽입할 수 없습니다
INSERT INTO CUSTOMER(PWD,NAME) VALUES('ok','kim');
⑧PRIMARY KEY의 유일성(UNIQUENESS) 과 존재성(NOT NULL)을 위반 하는 경우
UPDATE 명령이 수행되지 않는다.
UPDATE CUSTOMER SET ID = NULL;--존재성(NOT NULL)
UPDATE CUSTOMER SET ID = 'XMAN';--유일성(UNIQUENESS)
⑨ USER_CONSTRAINTS는 사용자 소유(Owner)의 모든 제약사항(CONSTRAINT)를 조회 할수 있다
USER_CONS_COLUMNS는 제약사항에 관련된 컬럼(COLUMN)의 정보를 조회할수 있다.
USER_INDEXES는 사용자 소유(Owner)의 모든 인덱스(INDEX)를 조회 할수 있다
USER_IND_COLUMNS는 인덱스에 관련된 컬럼(COLUMN)의 정보를 조회할수 있다.
개발이나 튜닝시 빈번하게 사용하게됨으로 실습을 통해 익혀두어야 한다.
SELECT TABLE_NAME,CONSTRAINT_NAME,CONSTRAINT_TYPE,SEARCH_CONDITION FROM USER_CONSTRAINTS
WHERE TABLE_NAME = 'CUSTOMER';
SELECT TABLE_NAME,CONSTRAINT_NAME,POSITION,COLUMN_NAME FROM USER_CONS_COLUMNS
WHERE TABLE_NAME = 'CUSTOMER' ORDER BY CONSTRAINT_NAME,POSITION;
SELECT INDEX_NAME,INDEX_TYPE,UNIQUENESS
FROM USER_INDEXES
WHERE TABLE_NAME = 'CUSTOMER';
SELECT INDEX_NAME,COLUMN_POSITION,COLUMN_NAME
FROM USER_IND_COLUMNS
WHERE TABLE_NAME = 'CUSTOMER' ORDER BY INDEX_NAME,COLUMN_POSITION;

```

## Foreign Key

> 연관성 있는 테이블간(내) 참조 무결성(Referential Integrity) 보장.
> 
- `FOREIGN KEY(column) REFERENCES PARENT(column)`  : 부모 TABLE의 column을 참조해라
- 부모 TABLE 간의 관계 및 종속성 설정
    - data의 생성, 삭제 등 관계 설정

```sql
CREATE TABLE 부서(부서번호 VARCHAR2(2) CONSTRAINT 부서_부서번호_PK PRIMARY KEY,
	부서명 VARCHAR2(10) CONSTRAINT 부서_부서명_NN NOT NULL
);

CREATE TABLE 사원(사번 VARCHAR2(8) PRIMARY KEY ,
	이름 VARCHAR2(10),
	부서번호 VARCHAR2(2),
		CONSTRAINT 사원_부서_부서번호_FK FOREIGN KEY(부서번호)
			REFERENCES 부서(부서번호) [ON DELETE CASCADE | SET NULL]
);
```