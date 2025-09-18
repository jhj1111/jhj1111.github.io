---
title: (DB) 4. Transaction
post_order: 4
thumbnail: https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgB6UK6F1kerv5HVXpp3z_LcBkQoc50lNQ9ZRPFzuIfSfjnaQo2Fr-O36SEhOvzGmXLSCnOY_yU6aMuVSInWE7nA0JglQoQzytnxcb0CHje9bk_8Wox2OzO6nfqqlfSuw4gBc5DXPrJ8rtn_uwERMgwvzA9nM03nVl9kKvpv_C_SJv8hmxfg0sMjLznDA/s16000/transaction.jpg
layout: post
author: jhj
categories:
  - StudyLog
  - DB
tags:
  - DB
  - function
  - command
excerpt: sql 연산 함수
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# SQL Script file

> ~ `.sh` 파일(linux shell script)
SQL문을 담고 있는 (text) 파일, 명령을 **순차적**, **반복적** 실행.
> 

## SQL-Developer에서 Script 파일 생성

- 파일 > 새로 만들기> 데이터베이스 파일 > SQL 파일 > 확인
- `.sql` 파일, 기타 편집기 사용 가능
- 주석
    - single-line : `--`
    - multi-line : `/* */`
- `;` 종료
    - `DESC` 는 `;` 없이 가능(있어도 됨)

## 파일 실행

- `실행 버튼` 클릭 or `F5`
    
    ![image.png](/assets/images/study_log/DB/2025-09-18-Transaction/image.png)
    
- 접속선택 : **devDinkDBMS** 선택 후 확인
- 종료 : 파일 > 닫기
- SQL-Developer에서 Script 파일 열기
    - 파일 > 열기 > c:\SQLDEV\test.sql

```sql
-- Single line comment
/*
    SQL Script Test
*/
    
SELECT * FROM TAB;
SELECT COUNT(*) FROM EMP;

DESC SALGRADE

DELETE FROM DEPT WHERE DEPTNO IS NULL;
ROLLBACK;
```

---

```sql
TNAME                                                                                                                            TABTYPE        CLUSTERID
-------------------------------------------------------------------------------------------------------------------------------- ------------- ----------
EXCEPTION_LOG                                                                                                                    TABLE                   
DEPT                                                                                                                             TABLE                   
EMP                                                                                                                              TABLE                   
BONUS                                                                                                                            TABLE                   
SALGRADE                                                                                                                         TABLE                   
DUMMY                                                                                                                            TABLE                   
CUSTOMER                                                                                                                         TABLE                   
EMP_LARGE                                                                                                                        TABLE                   
BONUS_LARGE                                                                                                                      TABLE                   
PRD_CODE                                                                                                                         TABLE                   
PRD_CODE_REG                                                                                                                     TABLE                   

TNAME                                                                                                                            TABTYPE        CLUSTERID
-------------------------------------------------------------------------------------------------------------------------------- ------------- ----------
BIN$JROyF1jgI4fgZQIMKatLyw==$0                                                                                                   TABLE                   
TEST_COMMIT                                                                                                                      TABLE                   

13개 행이 선택되었습니다. 

  COUNT(*)
----------
        14

이름    널? 유형     
----- -- ------ 
GRADE    NUMBER 
LOSAL    NUMBER 
HISAL    NUMBER 

0개 행 이(가) 삭제되었습니다.

롤백 완료.
```

# N개 Session 생성

# TRANSACTION

> 데이터베이스의 존재 목적은 데이터를 제공하고 데이터를 처리하는데 있으며
데이터베이스에서 데이터를 처리하는 논리적인 단위를 트랜잭션(Transaction)이라 한다.
SQL 명령어의 묶음
> 

![image.png](/assets/images/study_log/DB/2025-09-18-Transaction/image%201.png)

| 사전적 의미 | ①(업무,거래 따위의) 처리, ② 거래 , 매매 |
| --- | --- |
| 데이터베이스 | - 논리적 일의 단위(A logical unit of work)

- 1개의 논리적인 일은 N개의 물리적인 행위(Activity)의 묶음으로
  데이터베이스는 SQL을 통해서 일을 수행하고 행위(Activity)가 발생하므로
  일련의SQL 묶음이 트랜잭션(Transaction) |
- triple A
    - **A**logical unit of work
    - **A**tomic unit
    - **A**ll or Nothing
    논리적인 일의 단위로SQL의 묶음으로 **모든(ALL) SQL이 성공적으로 수행**되던가
    **모든SQL이 실행되지 않는(Nothing)** 쪼갤수 없는 하나의 원자적 단위(Atomic Unit)로
    처리된다
- 4가지 특징(특성)
    - 일관성(Consistency)
    - **원자성(Atomicity)**
    - **고립성(isolation)** : 변경을 진행중인 data는 **session별**로 독립되어 있음
    - **지속성(Durability)** : COMMIT만 실행된다면 복구가 가능

## 시작

> **실행 가능(Executable)**/**변경가능(mutable)**한 첫번째 SQL 실행 시 시작
> 
- `SELECT` 를 제외한 SQL 명령어

## 종료

> transaction 실행 시점까지 ROLLBACK 실행
> 

| 명시적 종료 | COMMIT, ROLLBACK |
| ----------- | ---------------- |
| 암시적 종료 | ① DDL,DCL 실행시 <br>- DML은 N개 명령어 묶음이1개의 트랜잭션 구성.<br>- DDL,DCL은1개 명령어가1개의 트랜잭션 구성.<br>* DDL,DCL명령어 시작시 트랜잭션을 시작하고 성공적으로 종료시에는 암시적(자동)으로COMMIT을 실행하고 <br>실패하면 암시적(자동)으로ROLLBACK을 실행하여 트랜잭션 종료.<br>② 비정상 종료시 자동으로 트랜잭션ROLLBACK 수행 <br>- Client(ex SQL-Developer) 프로그램 비정상 종료 <br>- 네트웍 단절(Oracle DBMS 와Client |

- 명시적 종료 : COMMIT, ROLLBACK
- 암시적 종료
    1. DDL,DCL 실행시
    - DML은 N개 명령어 묶음이 1개의 트랜잭션 구성.
    - **DDL**,**DCL**은 **1개 명령어**가 **1개의 트랜잭션** 구성.
    - DDL,DCL명령어 시작시 트랜잭션을 시작하고 성공적으로 종료 시에는 **암시적(자동)으로 COMMIT을 실행**하고 **실패**하면 **암시적(자동)으로ROLLBACK을 실행**하여 트랜잭션 종료.
    1. **비정상 종료**시 자동으로 **트랜잭션ROLLBACK 수행**
    - Client(ex SQL-Developer) 프로그램 비정상 종료
    - 네트웍 단절(Oracle DBMS 와Client Program간)
    - DBMS 비정상종료(Instance Crash)

## COMMIT, ROLLBACK

> COMMIT(저장) : IMAGE 단위 저장
> 
- data 변경 실행 : before image, after image 저장
- before image(other session), after image(해당 session)
- **ROLLBACK**, **읽기 일관성** 유지 가능

```sql
INSERT INTO DEPT(DEPTNO,DNAME,LOC) VALUES(90,'신사업부','경기도'); // 트랜잭션 시작

UPDATE EMP SET DEPTNO=90 WHERE DEPTNO=30; // 트랜잭션 진행중

DELETE FROM DEPT WHERE DEPTNO=30; // 트랜잭션 진행중

SELECT * FROM DEPT; // 변경 진행중인 데이터 조회 ①

SELECT * FROM EMP WHERE DEPTNO=30; // 변경 진행중인 데이터 조회 ①

ROLLBACK; // 트랜잭션 종료

SELECT * FROM DEPT; SELECT * FROM EMP; // Rollback 취소범위확인
```

---

```sql
1 행 이(가) 삽입되었습니다.

6개 행 이(가) 업데이트되었습니다.

1 행 이(가) 삭제되었습니다.

    DEPTNO DNAME          LOC          
---------- -------------- -------------
        50 M연구소        서울         
        51 T연구소        인천         
        90 신사업부       경기도       
        66 OUTER_BLK      Main_Blk     
        76 LOCAL_PART1    Nested_Blk1  
        86 LOCAL_PART2    Nested_Blk2  
        10 ACCOUNTING     NEW YORK     
        20 RESEARCH       DALLAS       
        40 OPERATIONS     BOSTON       

9개 행이 선택되었습니다. 

선택된 행 없음
롤백 완료.

    DEPTNO DNAME          LOC          
---------- -------------- -------------
        50 M연구소        서울         
        51 T연구소        인천         
        66 OUTER_BLK      Main_Blk     
        76 LOCAL_PART1    Nested_Blk1  
        86 LOCAL_PART2    Nested_Blk2  
        10 ACCOUNTING     NEW YORK     
        20 RESEARCH       DALLAS       
        30 SALES          CHICAGO      
        40 OPERATIONS     BOSTON       

9개 행이 선택되었습니다. 

     EMPNO ENAME      JOB              MGR HIREDATE        SAL       COMM     DEPTNO
---------- ---------- --------- ---------- -------- ---------- ---------- ----------
      7369 SMITH      CLERK           7902 80/12/17        800                    20
      7499 ALLEN      SALESMAN        7698 81/02/20       1600        300         30
      7521 WARD       SALESMAN        7698 81/02/22       1250        500         30
      7566 JONES      MANAGER         7839 81/04/02       2975                    20
      7654 MARTIN     SALESMAN        7698 81/09/28       1250       1400         30
      7698 BLAKE      MANAGER         7839 81/05/01       2850                    30
      7782 CLARK      MANAGER         7839 81/06/09       2450                    10
      7788 SCOTT      ANALYST         7566 82/12/09       3000                    20
      7839 KING       PRESIDENT            81/11/17       9500                    10
      7844 TURNER     SALESMAN        7698 81/09/08       9000          0         30
      7876 ADAMS      CLERK           7788 83/01/12       1100                    20

     EMPNO ENAME      JOB              MGR HIREDATE        SAL       COMM     DEPTNO
---------- ---------- --------- ---------- -------- ---------- ---------- ----------
      7900 JAMES      CLERK           7698 81/12/03        950                    30
      7902 FORD       ANALYST         7566 81/12/03       3000                    20
      7934 MILLER     CLERK           7782 82/01/23       1300                    10

14개 행이 선택되었습니다. 
```

- COMMIT을 통해 Transaction을 종료 → **COMMIT 전** ROLLBACK **불가**
    - 아래 예시에서 ROLLBACK된 data가 없음

```sql
INSERT INTO EMP(EMPNO,ENAME,JOB,SAL) VALUES(1111,'ORACLE','DBA',3500); // 트랜잭션 시작

UPDATE EMP SET SAL=SAL*1.3 WHERE EMPNO=1111; // 트랜잭션 진행중

COMMIT; // 트랜잭션 종료

ROLLBACK; //트랜잭션 종료 ②

SELECT * FROM EMP; // 데이터 조회
```

---

```sql
1 행 이(가) 삽입되었습니다.

1 행 이(가) 업데이트되었습니다.

커밋 완료.
롤백 완료.

     EMPNO ENAME      JOB              MGR HIREDATE        SAL       COMM     DEPTNO
---------- ---------- --------- ---------- -------- ---------- ---------- ----------
      1111 ORACLE     DBA                                 4550                      
      7369 SMITH      CLERK           7902 80/12/17        800                    20
      7499 ALLEN      SALESMAN        7698 81/02/20       1600        300         30
      7521 WARD       SALESMAN        7698 81/02/22       1250        500         30
      7566 JONES      MANAGER         7839 81/04/02       2975                    20
      7654 MARTIN     SALESMAN        7698 81/09/28       1250       1400         30
      7698 BLAKE      MANAGER         7839 81/05/01       2850                    30
      7782 CLARK      MANAGER         7839 81/06/09       2450                    10
      7788 SCOTT      ANALYST         7566 82/12/09       3000                    20
      7839 KING       PRESIDENT            81/11/17       9500                    10
      7844 TURNER     SALESMAN        7698 81/09/08       9000          0         30

     EMPNO ENAME      JOB              MGR HIREDATE        SAL       COMM     DEPTNO
---------- ---------- --------- ---------- -------- ---------- ---------- ----------
      7876 ADAMS      CLERK           7788 83/01/12       1100                    20
      7900 JAMES      CLERK           7698 81/12/03        950                    30
      7902 FORD       ANALYST         7566 81/12/03       3000                    20
      7934 MILLER     CLERK           7782 82/01/23       1300                    10

15개 행이 선택되었습니다. 
```

- 문장 범위 ROLLBACK(Statemnet Level ROLLBACK)
    - **취소(ROLLBACK) 범위**가 에러가 발생한 **해당 명령만 적용**
    - DBMS가 **자동적으로 실행**
    - 아래 예시의 DELETE와 2번째 UPDATE만 실행
    - 즉 **원자성(All or Nothing) 성립 X**

```sql
ROLLBACK; // 이전 트랜잭션 종료

DELETE FROM EMP WHERE EMPNO=1111; // 트랜잭션 시작

UPDATE EMP SET SAL=123456789 WHERE EMPNO=7788 // 진행중, 에러발생 ①

UPDATE EMP SET SAL=1234 WHERE EMPNO=7902; // 실행orSKIP ? - 실행

COMMIT; // 트랜잭션 종료②

SELECT EMPNO,SAL FROM EMP WHERE EMPNO IN(1111,7788,7902); // 트랜잭션 일부만 반영
```

---

```sql
롤백 완료.

1 행 이(가) 삭제되었습니다.

명령의 5 행에서 시작하는 중 오류 발생 -
UPDATE EMP SET SAL=123456789 WHERE EMPNO=7788 // 진행중, 에러발생 ①

UPDATE EMP SET SAL=1234 WHERE EMPNO=7902
오류 발생 명령행: 5 열: 48
오류 보고 -
SQL 오류: ORA-00936: 누락된 표현식
00936. 00000 -  "missing expression"
*Cause:    
*Action:
커밋 완료.

     EMPNO        SAL
---------- ----------
      7788       3000
      7902       3000
```

- 트랜잭션 범위 ROLLBACK(Transaction Level ROLLBACK)
    - **PL/SQL**의 **예외처리(EXCEPTION)** 기능을 사용하여 **트랜잭션의 원자성 보장**
    - 프로그래밍 언어의 예외처리(에러처리) 기능을 사용해야 올바른 **트랜잭션 제어**
    - 정상 실행 → COMMIT, error 발생 → ROLLBACK
    - **Exeption**을 통한 **run-time error 처리**

```sql
BEGIN // PL/SQLBlock시작
    DELETE FROM EMP WHERE DEPTNO=20; // 트랜잭션 시작 ①
    UPDATE EMP SET SAL=123456789 WHERE EMPNO=7499; // 에러발생 ②
    UPDATE EMP SET SAL=1234 WHERE EMPNO=7698; // 실행 SKIP ③
    COMMIT; // 실행 SKIP ④
EXCEPTION // 예외처리부 ⑤
    WHEN OTHERS THEN
        ROLLBACK; // ⑤ 트랜잭션 레벨 ROLLBACK
END; // PL/SQLBlock종료
/ // Block실행(SendtoDBMS)
SELECT EMPNO,SAL FROM EMP WHERE DEPTNO = 20 or EMPNO IN (7499,7698); // 결과확인
```

---

```sql
명령의 1 행에서 시작하는 중 오류 발생 -
BEGIN // PL/SQLBlock시작
    DELETE FROM EMP WHERE DEPTNO=20; // 트랜잭션 시작 ①
    UPDATE EMP SET SAL=123456789 WHERE EMPNO=7499; // 에러발생 ②
    UPDATE EMP SET SAL=1234 WHERE EMPNO=7698; // 실행 SKIP ③
    COMMIT; // 실행 SKIP ④
EXCEPTION // 예외처리부 ⑤
    WHEN OTHERS THEN
        ROLLBACK; // ⑤ 트랜잭션 레벨 ROLLBACK
END; // PL/SQLBlock종료
/ // Block실행(SendtoDBMS)
SELECT EMPNO,SAL FROM EMP WHERE DEPTNO = 20 or EMPNO IN (7499,7698); // 결과확인
오류 보고 -
ORA-06550: 줄 1, 열7:PLS-00103: 심볼 "/"를 만났습니다 다음 중 하나가 기대될 때:
   ( begin case declare exit for goto if loop mod null pragma
   raise return select update while with <식별자>
   <큰 따옴표로 구분된 식별자> <바인드 변수> <<
   continue close current delete fetch lock insert open rollback
   savepoint set sql execute commit forall merge pipe purge
   json_exists json_value json_query json_object json_array
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:
```

- TRANSACTION과 DDL
    - 1개의 **DDL**, **DCL**은 1개의 **TRANSACTION을 형성**
    - 즉 DDL, DCL은 **성공**시 → **COMMIT**, **실패**시 → **ROLLBACK**

```sql
INSERT INTO EMP(EMPNO,ENAME,DEPTNO) VALUES(9999,'OCPOK',20); // TRANSACTION START
ALTER TABLE EMP ADD( SEX CHAR(1) DEFAULT 'M'); // DDL - implicit COMMIT 
ROLLBACK; // 취소 범위는? - NONE
DESC EMP;
ALTER TABLE EMP DROP COLUMN SEX; // DDL - implicit COMMIT 
ROLLBACK; // 취소 범위는? - NONE
DESC EMP
```

- Row Level Lock
    - 다중 Transaction 수행 시 **data 무결성 보장**하기 위한 **LOCK 매커니즘**
    - Lock 생성 : Transaction 진행 시 **변경 대상 ROW**에 자동으로 **Exclusive Row Level Lock** 생성
    - Lock 해제: 트랜잭션 **종료시(명시적,암시적) 해제**
    - Lock 생성 시 **해제(COMMIT, ROLLBACK) 수행 전**까지 다른 session은 대기
- Table Level Lock