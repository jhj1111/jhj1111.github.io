---
title: (C++)8. 배열, 포인터, 레퍼런스
post_order: 8
thumbnail: /assets/images/study_log/cpp/2025-06-17-ArrayPointerReference/spiderman_thumnail.jpg
layout: post
author: jhj
categories:
  - StudyLog
  - Cpp
tags:
  - Programming
  - Language
  - C++
excerpt: 배열(array), 포인터(pointer), 레퍼런스(reference)의 작동원리와 주의점
project_rank: "600"
sticker: emoji//1f4aa
---

# 메모리 구조
![](/assets/images/study_log/cpp/2025-06-17-ArrayPointerReference/memory_structure_member.png)

- 코드(Code) : 프로그램 소스코드 영역
- 데이터(Data) : 프로그램 **시작시 할당**, **종료 시 소멸**되는 변수
- 힙(Heap) : 메모리 크기를 동적으로 할당하는 변수. 메모리의 **해제 필수**
- 스택(Stack) : 지역변수 저장

# 배열(array)
> 동일한 자료형 값을 메모리 공간에 순차적으로 여러 개 저장하여 사용하기 위한 방법.
연속적으로 만들어지기 때문에 순차적으로 접근(sequential acess), 무작위 접근(random acess) 가능하다.

- `<type> <name>[<value>]`
	- `<value>` : **constant-value**, **variable**, **blank**(초기화 사용 시)
- 반드시 배열을 사용해야 하는 경우가 아니라면 표준 라이브러리의 **시퀀스 컨테이너(sequence container) 사용** 권장
	- `std::array<T,N>` : 크기가 결정되어 있고 자료 추가가 없을 경우
	- `std::vector<T>` \| `std::deque<T>` : 동적으로 자료가 추가될 경우

```cpp
#include <iostream>
#include <algorithm> // for std::copy
#include <iterator> // for std::ostream_iterator
#include <array>    // for std::array
#include <vector>   // for std::vector
#include <deque>    // for std::deque


int main() {
    int n = 5;

    // 1. 정적 배열 (stack, 고정 크기)
    int arr1[] = {1, 2, 3, 4, 5};
    int arr1[5];
    int arr1[n] = {1, 2, 3, 4, 5}; // C++에서는 n을 상수로 사용해야 함

    copy(arr1, arr1 + n, std::ostream_iterator<int>(std::cout, " "));
    std::cout << std::endl;

    // 2. 동적 배열 (heap, new/delete)
    int* arr2 = new int[5];
    int* arr2 = new int[5]{10, 20, 30, 40, 50};
    
    copy(arr2, arr2 + 5, std::ostream_iterator<int>(std::cout, " "));
    std::cout << std::endl;
    
    delete[] arr2; // 동적 메모리는 수동 해제 필요
    
    // 3. std::array (C++11, 고정 크기 배열, stack)
    std::array<int, 5> arr3 = {100, 200, 300, 400, 500};

    copy(arr3.begin(), arr3.end(), std::ostream_iterator<int>(std::cout, " "));
    std::cout << std::endl;

    // 4. std::vector (가변 크기, heap 기반)
    std::vector<int> arr4 = {7, 14, 21};
    std::deque<int> arr4 = {7, 14, 21};
    arr4.push_back(28);

    copy(arr4.begin(), arr4.end(), std::ostream_iterator<int>(std::cout, " "));
    std::cout << std::endl;

    return 0;
}
```
 
# 네이티브 포인터(native pointer)
> 정의된 자료형의 메모리 주소를 저장하는 변수.
**스마트 포인터(smart pointer)** 도입 이후 **C-style pointer**를 **네이티브 포인터(native pointer)** 라고 한다.

- `<type>* <value>`
	- `<type>*` : **포인터 자료형**(type of pointer)
	- `<value>` : 포인터(variable of pointer)
	- 일반적으로 포인터 자료형을 포인터라고 함
 
## 연산자(operator)
- `*`, `->`, `--`, `++`, `+`, `-`, `==`, `<`, `>`, `[]` 등

```cpp
#include <iostream>
#include <string>

// -> 연산자 예시용 구조체
struct Person {
    std::string name;
    int age;

    void introduce() {
        std::cout << "Hi, I'm " << name << " and I'm " << age << " years old.\n";
    }
};

int main() {
    int arr[5] = {10, 20, 30, 40, 50};

    // 1. 포인터 선언 및 주소 저장
    int* p = arr; // arr == &arr[0]
    std::cout << "p points to: " << *p << "\n";  // 10

    // 2. 포인터 산술 연산
    ++p;
    std::cout << "After ++p, *p = " << *p << "\n";  // 20

    p += 2;
    std::cout << "After p += 2, *p = " << *p << "\n";  // 40

    // 3. 포인터 역참조 (*)
    *p = 100;  // arr[3] = 100
    std::cout << "Modified arr[3]: " << arr[3] << "\n";  // 100

    // 4. 포인터 비교 연산
    int* p1 = &arr[1];
    int* p2 = &arr[4];
    if (p1 < p2) {
        std::cout << "p1 points to an earlier element than p2\n";
    }

    // 5. 포인터 간 거리 계산
    int diff = p2 - p1;
    std::cout << "p2 - p1 = " << diff << " elements\n";  // 3

    // 6. 배열을 포인터로 순회
    std::cout << "Traverse arr using pointer (*): ";
    int* ptr = arr;
    for (int i = 0; i < 5; ++i) {
        std::cout << *(ptr + i) << " ";
    }
    std::cout << "\n";

    // 7. 포인터와 [] 연산자
    std::cout << "Access arr using pointer and []: ";
    for (int i = 0; i < 5; ++i) {
        std::cout << ptr[i] << " ";  // *(ptr + i) 와 동일
    }
    std::cout << "\n";

    // 8. -> 연산자 예시
    Person person = {"Alice", 25};
    Person* personPtr = &person;

    std::cout << "Using -> operator:\n";
    std::cout << "Name: " << personPtr->name << ", Age: " << personPtr->age << "\n";
    personPtr->introduce();  // 구조체 멤버 함수 호출

    // (*ptr). 방식도 동일한 효과
    (*personPtr).age = 26;
    std::cout << "After (*personPtr).age = 26:\n";
    (*personPtr).introduce();

    return 0;
}
```

## 널 포인터(Null Pointer)
- `0`, `NULL`, `(void*)0`, `nullptr` 
	- `0` 의 경우 <int\> 타입이며 포인터가 아니지만, **null 포인터 상수**로 취급
- `nullptr` 사용 권장
	- 명확한 **pointer type**
	- pointer 외에 **다른 타입으로의 implicit conversion 방지**(int, bool 등)

|표현|타입|설명|
|---|---|---|
|`0`|`int`|null 표현으로 허용되지만 본질은 정수|
|`NULL`|매크로 (`0` or `(void*)0`)|정의에 따라 다름, C 스타일, 위험성 존재|
|`(void*)0`|`void*`|void 포인터 타입 → 타입 변환 필요|
|`nullptr`|`std::nullptr_t`|C++11 도입, **명확한 null 포인터 타입**, 타입 안정성 ↑|

```cpp
#include <iostream>
#include <typeinfo>

using namespace std;

int main()
{
    printf("%s, %lu\n", typeid(0).name(), sizeof(0));
    printf("%s, %lu\n", typeid(NULL).name(), sizeof(NULL));
    printf("%s, %lu\n", typeid((void*)0).name(), sizeof((void*)0));
    printf("%s, %lu\n", typeid(nullptr).name(), sizeof(typeid(nullptr).name()));
}

>>> 

i, 4
l, 8
Pv, 8
Dn, 8
```

## 다차원 배열
- 다차원 배열 형태로 자료를 사용할 경우, 각 자료형에 맞게 할당을 하고 모두 해제해야 함
	- `int** pMatrix = new int[i][j]` : <span style="color:rgb(255, 0, 0)">compile error</span>

```cpp
int** pMatrix = new int*[10];
for (size_t i = 0; i < 10; i++)
    pMatrix[i] = new int[10];
//... do something

for (size_t i = 0; i < 10; i++)
    delete [] pMatrix[i];
delete [] pMatrix;
```

# 레퍼런스(reference)
> 포인터는 NULL이 될 수 있으나, 참조자는 **존재하는 것만 지정 가능(alias)** 하다.
이름만 대신하는 방식으로 동작하며, 일반적인 지역 변수 사용과 동일한 형태이기 때문에 사용하기 편하다. 

- 지정한 변수와 **동일한 주소값**을 가짐
- `const <type>& <var>`
	- reference는 존재하는 변수의 주소값을 받으나
	- `const` 의 경우 예외적으로 <span style="color:rgb(255, 0, 0)">rvalue를 받을 수 있음</span>
	- 임시로 존재하는 객체의 값을 참조만 할 뿐, **변경이 불가**(원칙상으로는)하기 때문

```cpp
#include <iostream>

int& func(int &a){return a;}

int main() {
  int x = 10;
  int& ref = x; // Binding reference to x
  int& ref = func(x); // Binding reference to the return value of func

  const int& r1 = 20; // Binding a const reference to a temporary
  int& r2 = 30; // error, Binding a non-const reference to a temporary
  
  return 0;
}
```

- compile 후 실행은 pointer와 동일

```cpp
class DataType {
    int n;
    double d;
};
DataType fnRef(DataType const & data) { return data; }
DataType fnPnt(DataType const * data) { return *data; }
```

- 편리성을 증가시키고 자원관리 문제를 해소하는 역할을 하지만
- 소유권 이전 문제가 존재(alias)
	- **rvalue 참조자** 
	- <span style="color:rgb(255, 0, 0)">이동생성자(move constructor)</span>와 <span style="color:rgb(255, 0, 0)">이동대입연산자(move assignment operator)</span> 

## lvalue 참조자
> 함수의 call by reference 기능을 지원한다.
즉 객체를 복사하지 않고 사용 가능하며, 객체 다형성 기능을 사용할 수 있다.
lvalue 참조자를 const로 정의한 경우 임시 객체를 사용할 수 있다.

```cpp
void func(int& n) { do somethings...; }
void func_const(const int& n) { do somethings... }

int n = 100;
func(n); // ok
func_const(n); // ok

func(10); // error
func_const(10); // ok
```

- **사용자 정의 자료형**의 객체를 **매개변수**로 사용하는 경우 참조자 사용
- `const <type>& <var>` 매개변수 사용
	- 객체의 **값을 바꾸지 않는 경우**
	- **임시 객체를 사용**하는 경우

```cpp
#include <bits/stdc++.h>

struct DataType {
    int n;
    double d;
    std::string str;
    std::string to_string() const {
        std::ostringstream oss;
        oss << n << ',' << d << ',' << str;
        return oss.str();
    }
};

void func(DataType& data) {
    std::cout << data.to_string() << '\n';
}
void func_const(const DataType& data) {
    std::cout << data.to_string() << '\n';
}

int main() {
    DataType Data{10, 3.14, "ABC"};
    func(Data); // ok
    //func(DataType{7, 0.12, "LMN"}); // error
    func_const(Data); // ok, Data 유지
    func_const(DataType{1, 2.18, "XYZ"}); // ok, 임시 객체
}
```

## rvalue 참조자
> 자료 복사의 경우 동일한 데이터가 두 개 이상 존재하는 것을 의미한다.
데이터가 적을 시 문제가 되지 않지만 용량이 커질 경우 문제가 발생한다.
이를 피하기 위해 reference의 값을 넘겨주기 위해 사용되는 것이 rvalue 참조자다.

### rvlaue 이동 생성
> 다른 변수로 값을 넘겨줄 때 데이터를 복사하지 않고 넘겨주는 경우를 의미한다.

- `<type,class 등> func(<type> &&<var>)` 
	- 임시 생성 객체 `<var>` 의 경우 lvalue reference와 동일하게 **argument의 참조**를 받아옴
	- 함수 내부에서 임시 생성 객체의 데이터를 다른 변수로 넘겨줄 때 **데이터를 건내줌**

![](/assets/images/study_log/cpp/2025-06-17-ArrayPointerReference/rvalue_reference_move.png)

- 단, 이 과정에서 `var`은 데이터와 함께 <span style="color:rgb(255, 0, 0)">삭제 권한</span>도 함께 넘어감
	- 즉 `new_var` 이 삭제(delete)될 때 `var` 도 함께 삭제
	- 하지만  `var` 과 `new_var` 은 같은 주소를 참조하고 있으므로 <span style="color:rgb(255, 0, 0)">중복 삭제 에러 발생</span>
- 중복 삭제 방지
	- `new_var = nullptr` 로 설정
	- 이후 <span style="color:rgb(255, 0, 0)">nullptr 삭제 방지</span>(`if (<var>) delete <var>;`)
	- `new_var` 삭제(delete) 시 `var` 도 <span style="color:rgb(255, 0, 0)">같이 삭제</span> 되므로 중복 삭제 문제 해결, 안전하게 free 실행

```cpp
#include <iostream>
#include <cstring>

class MyString {
private:
    char* string_content;
    int string_length;

public:
    // 생성자
    MyString(const char* str) {
        string_length = std::strlen(str);
        string_content = new char[string_length + 1];
        std::strcpy(string_content, str);
        std::cout << "생성자 호출\n";
    }

    // 소멸자
    ~MyString() {
		if (string_content){
		  std::cout << "소멸자 호출: " << (void*)string_content << std::endl;
		  delete[] string_content;
		}
    }

    // 이동 생성자
    MyString(MyString&& str) {
        std::cout << "이동 생성자 호출\n";
        string_content = str.string_content;
        string_length = str.string_length;

        // str.string_content = nullptr;
    }
};

int main() {
    MyString a("Hello");
    MyString b = std::move(a);  // 이동 생성자 호출

    // main 끝 → b와 a 둘 다 소멸자 호출
    // 둘 다 같은 포인터에 대해 delete[] 실행 → double delete!
    return 0;
}

>>> 
// nullptr 미설정
생성자 호출
이동 생성자 호출
소멸자 호출: 0x7b8b20
소멸자 호출: 0x7b8b20		// 같은 주소 중복 삭제 발생, error
```

---

```cpp
// nullptr 설정
생성자 호출
이동 생성자 호출
소멸자 호출: 0x7b8b20		// delete 성공, 종료
```

- 함수의 argument로 생성자를 입력할 시, 복사 생략(Copy elision)이 발생하며, **rvalue reference를 호출**

```cpp
#include <iostream>
#include <vector>

template <typename T>
void wrapper(T& u) {
  std::cout << "T& 로 추론됨" << std::endl;
  g(u);
}

template <typename T>
void wrapper(const T& u) {
  std::cout << "const T& 로 추론됨" << std::endl;
  g(u);
}

class A {};

void g(A& a) { std::cout << "좌측값 레퍼런스 호출" << std::endl; }
void g(const A& a) { std::cout << "좌측값 상수 레퍼런스 호출" << std::endl; }
void g(A&& a) { std::cout << "우측값 레퍼런스 호출" << std::endl; }

int main() {
  A a;
  const A ca;

  g(a);		// 좌측값 레퍼런스 호출
  g(ca);	// 좌측값 상수 레퍼런스 호출
  g(A());	// 우측값 레퍼런스 호출
```

### 이동 생성의 noexept
> vector와 같은 **컨테이너의 이동 생성 실행** 시, 이동 생성자를 **noexept로 명시**해야 한다.

- 원소를 추가할 때, 새로운 메모리를 할당한 후에 기존에 있던 원소들을 새로운 메모리로 옮겨야 함
- 기존에 할당된 메모리보다 추가할 데이터가 클 경우 
	- 할당된 메모리에 최대한 복사 후,
	- **복사 완료된 메모리를 해제**, 초과된 데이터 복사
	- 이동 생성의 경우, 이 과정에서 **메모리와 함께 데이터가 함께 사라짐**
	- 따라서 **컨테이너 타입**의 경우 <span style="color:rgb(255, 0, 0)">noexcept가 없을 시 복사 생성 실행</span>

![](/assets/images/study_log/cpp/2025-06-17-ArrayPointerReference/rvalue_noexept.png)

```cpp
#include <iostream>
#include <cstring>
#include <vector>

class MyString {
  char *string_content;  // 문자열 데이터를 가리키는 포인터
  int string_length;     // 문자열 길이

  int memory_capacity;  // 현재 할당된 용량

 public:
  // 기본 생성자
  MyString();
  // 문자열로 부터 생성
  MyString(const char *str);
  // 복사 생성자
  MyString(const MyString &str);
  // 이동 생성자
  MyString(MyString &&str) noexcept;
  ~MyString();
};

// 생성자, 복사 생성자 생략

MyString::MyString(MyString &&str) noexcept{
  std::cout << "이동 생성자 호출 !" << std::endl;
  string_length = str.string_length;
  string_content = str.string_content;
  memory_capacity = str.memory_capacity;

  // 임시 객체 소멸 시에 메모리를 해제하지
  // 못하게 한다.
  str.string_content = nullptr;
}
MyString::~MyString() {
  if (string_content) delete[] string_content;
}

int main() {
  MyString s("abc");
  std::vector<MyString> vec;
  vec.resize(0);

  std::cout << "첫 번째 추가 ---" << std::endl;
  vec.push_back(s);
  std::cout << "두 번째 추가 ---" << std::endl;
  vec.push_back(s);
  std::cout << "세 번째 추가 ---" << std::endl;
  vec.push_back(s);
}

>>> 
// noexept 미설정
생성자 호출 ! 
첫 번째 추가 ---
복사 생성자 호출 ! 
두 번째 추가 ---
복사 생성자 호출 ! 
복사 생성자 호출 ! 
세 번째 추가 ---
복사 생성자 호출 ! 
복사 생성자 호출 ! 
복사 생성자 호출 !
```

---

- **noexept 설정** 시 정상적으로 이동 생성자 호출

```cpp
// noexept 설정
생성자 호출 ! 
첫 번째 추가 ---
복사 생성자 호출 ! 
두 번째 추가 ---
복사 생성자 호출 ! 
이동 생성자 호출 !
세 번째 추가 ---
복사 생성자 호출 ! 
이동 생성자 호출 !
이동 생성자 호출 !
```

### lvalue 이동생성, Universal reference
> lvalue를 인자로 사용할 경우 값을 복사하는 복사 생성을 실행한다.
rvalue를 이용한 이동 생성처럼 불필요한 복사를 삭제하기 위해 rvalue casting을 이용한다.

- `std::move` : lvalue -> rvalue 형변환
	- 단순히 형변환을 실행할 뿐, **직접적인 값의 이동을 실행하진 않음**
	- `&&` 의 매개변수로 사용 가능

```cpp
#include <iostream>
#include <utility>

class A {
 public:
  A() { std::cout << "일반 생성자 호출!" << std::endl; }
  A(const A& a) { std::cout << "복사 생성자 호출!" << std::endl; }
  A(A&& a) { std::cout << "이동 생성자 호출!" << std::endl; }
};

int main() {
  A a;					// 일반 생성자 호출!
  A b(a);				// 복사 생성자 호출!
  A c(std::move(a));	// 이동 생성자 호출!
}
```

- 보편적 레퍼런스(universal reference)
	- template의 경우 parameter가 lvalue, rvalue인지 알 수 없음
	- lvalue와 rvalue 모든 경우의 수를 오버로딩하려면 경우의 수가 너무 많음

```cpp
template <typename T>
void wrapper(T& u, T& v) {
  g(u, v);
}
template <typename T>
void wrapper(const T& u, T& v) {
  g(u, v);
}

template <typename T>
void wrapper(T& u, const T& v) {
  g(u, v);
}
template <typename T>
void wrapper(const T& u, const T& v) {
  g(u, v);
}
```

- `argument == &&`  : **rvalue** 오버로딩
- `그 외`  : **lvalue** 오버로딩

- `std::forward` : 매개변수로 받은 인수를 보고 적절한 자료형을 반환
	- **template**에서 **rvalue reference**를 받을 수 있음

```cpp
#include <iostream>

template <typename T>
void wrapper(T&& u) {
  g(std::forward<T>(u));
  // g(u);
}

class A {};

void g(A& a) { std::cout << "좌측값 레퍼런스 호출" << std::endl; }
void g(const A& a) { std::cout << "좌측값 상수 레퍼런스 호출" << std::endl; }
void g(A&& a) { std::cout << "우측값 레퍼런스 호출" << std::endl; }

int main() {
  A a;
  const A ca;

  wrapper(a);	// 좌측값 레퍼런스 호출
  wrapper(ca);	// 좌측값 상수 레퍼런스 호출
  wrapper(A());	// 우측값 레퍼런스 호출
  				// g(u); -> 좌측값 레퍼런스 호출
}
```

---

- forward 미사용

```cpp
#include <iostream>
#include <vector>

template <typename T>
void wrapper(T& u) {
  std::cout << "T& 로 추론됨" << std::endl;
  g(u);
}

template <typename T>
void wrapper(const T& u) {
  std::cout << "const T& 로 추론됨" << std::endl;
  g(u);
}

class A {};

void g(A& a) { std::cout << "좌측값 레퍼런스 호출" << std::endl; }
void g(const A& a) { std::cout << "좌측값 상수 레퍼런스 호출" << std::endl; }
void g(A&& a) { std::cout << "우측값 레퍼런스 호출" << std::endl; }

int main() {
  A a;
  const A ca;

  wrapper(a);
  wrapper(ca);
  wrapper(A());
}

>>> 

T& 로 추론됨
좌측값 레퍼런스 호출
const T& 로 추론됨
좌측값 상수 레퍼런스 호출
const T& 로 추론됨
좌측값 상수 레퍼런스 호출
```

## Side Effect
> pass-by-reference의 경우 main과 subprogram (function, class, ...)이 동일한 변수를 가진다.
따라서 프로그래밍 동작이 의도하지 않게 작동하는 경우가 발생할 수 있기 때문에 주의가 필요하다.

- 함수 호출자가 의도치 않게 영향을 받음
- 컴파일 오류나 UB이 아니기 때문에 <span style="color:rgb(255, 0, 0)">오류를 미리 탐지할 수도 없고</span>
- 동작을 <span style="color:rgb(255, 0, 0)">예측하기도 어렵다</span>(논리적 오류 발생)

1. 동일 참조의 중복 전달 – Aliasing 문제

```cpp
#include <iostream>
#include <iterator>

void sub(int& a, int& b) {
    a = a - b;
}

int main() {
    int p1 = 10;
    sub(p1, p1);  // 예상? => p1 = 10 - 10 = 0
    std::cout << p1 << "\n";  // OK, 하지만 의미가 애매해짐
}
```

2. 참조된 값에 영향을 주는 인덱스 변경

```cpp
void sub(int& val, int& idx) {
    idx = 0;
    val = val + 100;  // list[0]을 조작할 수도 있음
}

int main() {
    int list[3] = {10, 20, 30};
    int p1 = 2;
    sub(list[p1], p1);  // list[2]와 p1을 전달

    std::copy(list, list + 3, std::ostream_iterator<int>(std::cout, " "));  // 출력: 110 20 30

    // 문제는 함수 내부에서 p1 = 0으로 바꾸면
    // val은 list[2]를 참조할까, list[0]을 참조할까? (UB 아님, but 모호)
}
```

3. 루프 도중 컨테이너 구조 변경
- 매우 위험한 동작
- 설명을 위한 예시일 뿐 실제로 다음과 같이 사용하는 경우는 거의 없다(~~vector 기능 놔두고 굳이..~~)

```cpp
#include <iostream>
#include <vector>
#include <iterator>

void list_print(std::vector<int>& vec) {
    size_t size = vec.size();

    for (size_t i = 0; i < size; ++i) {
        std::copy(vec.begin(), vec.end(), std::ostream_iterator<int>(std::cout, " "));
        std::cout << "\n";
        printf("vec[%zu] = %d\n", i, vec[i]);
        vec.erase(vec.begin());  // 첫 번째 요소 삭제
    }
}

int main() {
    std::vector<int> vec = {1, 2, 3, 4, 5};
    
    list_print(vec);
    return 0;
}

>>> 

1 2 3 4 5 
vec[0] = 1
2 3 4 5
vec[1] = 3
3 4 5
vec[2] = 5	// UB
4 5
vec[3] = 5	// UB
5
vec[4] = 5	// UB
```

- 함수의 작동원리를 정확히 이해하고 사용(**pass-by-value**, **pass-by-reference**)
- 불변, 가변 데이터를 구분
	- 일정한 데이터는 <span style="color:rgb(255, 0, 0)">constant</span> (`const` \| `const&`)로 값 고정

# 문자, 문자 리터럴


