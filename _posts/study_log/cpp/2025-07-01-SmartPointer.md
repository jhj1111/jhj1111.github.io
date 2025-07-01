---
title: (C++)8. 스마트 포인터
post_order: 9
thumbnail: https://miro.medium.com/v2/resize:fit:898/1*wYw8dYdGd0JabdkBrMiwIQ.png
layout: post
author: jhj
categories:
  - StudyLog
  - Cpp
tags:
  - Programming
  - Language
  - C++
excerpt: reference의 소멸 및 소유권 등을 조절하는 c++의 포인터
project_rank: "600"
sticker: emoji//1f4aa
---
# reference와 smart pointer
> c/c++은 garbage collector가 존재하지 않기 때문에 **소멸자를 직접 호출**해야 한다.
> 또한 reference는 여러 변수가 소유권을 공유하므로 **이중 소멸 문제가 발생**하기 쉽다.

- Memory leak 등 문제 발생

```cpp
#include <iostream>

class A {
  int *data;

 public:
  A() {
    data = new int[100];
    std::cout << "자원을 획득함!" << std::endl;
  }

  ~A() {
    std::cout << "소멸자 호출!" << std::endl;
    delete[] data;
  }
};

void do_something() { 
	A *pa = new A(); 
	// delet pa;	// 소멸자 생략
}

int main() {
  do_something();	// 자원을 획득함!

  // 할당된 객체가 소멸(소멸자 호출!)되지 않음!
  // 즉, 400 바이트 (4 * 100) 만큼의 메모리 누수 발생
}
```

- **RAII(Resource Acquisition Is Initialization)**
	- 자원의 **생애주기**(life cycle)를 객체의 **생애(lifetime)에 바인딩**시키는 기법
	- **stack unwinding** : 스택에 정의되어 있는 객체는 block이 끝나면 소멸자 자동 호출
	- <span style="color:rgb(255, 0, 0)">포인터 객체</span>로 RAII를 실현
- 변수 및 메소드 참조 등은 **일반 포인터와 동일**하게 작동
	- **복사** 및 **함수 호출** 구현은 다를 수 있음
- auto_ptr : 더이상 사용하지 않음

# unique_pointer
> 단일 소유권 부여를 통해 해제된 메모리의 소멸(double free) 방지.

- 단일 소유권 -> 소유권 명확히
- `std::unique_ptr<type> var(new constructor)`
- `std::unique_ptr<type> var = std::make_unique<type>(params)`

```cpp
class A {
	int a,b;
	
	public:
	A(int a, int b) : a(a), b(b) {}
	...
}

std::unique_ptr<A> ptr(new A(3,5));
std::unique_ptr<A> ptr = std::make_unique<A>(3,5);
auto ptr = std::make_unique<A>(3,5);
```

- **복사 생성자**가 deleted function로 <span style="color:rgb(255, 0, 0)">금지</span>
	- 삭제된 함수(deleted function) : `A(cont A& a) = delete;`처럼 **delete**를 통해 **해당 함수를 금지**시키는 기능.
- `std::move`를 통한 소유권 이전은 가능
- `obj.get()` : get 함수, 주소값 반환
	- 이동 완료된 pointer -> nullptr

```cpp
#include <iostream>
#include <memory>

class A {
  int *data;
  ...
};

void do_something() {
  std::unique_ptr<A> pa(new A());

  std::unique_ptr<A> pb = pa;	// 복사 생성 금지, error
  std::unique_ptr<A> pb = std::move(pa);	// 가능
  std::cout << pa.get() << "\n";	// 0 (nullptr)
}

int main() { do_something(); }	// error
```

- reference를 argument 전달은 가능하나, 유일한 소유권 기능 상실
	- 포인터 주소값 전달(**get 함수**)을 통해 기능 유지

```cpp
#include <iostream>
#include <memory>

class A {
  ...

void do_something(A* ptr) { ptr->do_sth(3); }

int main() {
  std::unique_ptr<A> pa(new A());
  do_something(pa.get());
}
```

- unique_ptr **컨테이너**
	- 컨테이너의 push : **복사 생성**, 따라서 unique_ptr 사용 불가
	- 우측값 레퍼런스, 즉 `std::move` 이용

```cpp
#include <iostream>
#include <memory>
#include <vector>

class A {
  int *data;

 public:
  A(int i) {
    std::cout << "자원을 획득함!" << std::endl;
    data = new int[100];
    data[0] = i;
  }

  void some() { std::cout << "일반 포인터와 동일하게 사용가능!" << std::endl; }

  ~A() {
    std::cout << "자원을 해제함!" << std::endl;
    delete[] data;
  }
};

int main() {
  std::vector<std::unique_ptr<A>> vec;
  std::unique_ptr<A> pa(new A(1));

  vec.push_back(pa);  // error, 겁나 김
  vec.push_back(std::move(pa));	// good
}
```

# share_pointer
> 소유권을 복수의 변수가 공유해야 할 때 사용.
> referenc counter를 통해 소멸자 호출을 관리한다.

![](/assets/images/study_log/cpp/2025-07-01-SmartPointer/share_ptr.png)
출처 : [https://modoocode.com/252](https://modoocode.com/252)

- `obj.use_count()` : reference counter
	- **ref conut** == 0 -> 소멸자 호출
- **제어 블록(control block)** 생성, 공유
- `std::shared_ptr<type> var(new constructor)`
- `std::shared_ptr<type> var = std::make_shared<type>(params)` :  동적 바인딩 최소화
	- shared_ptr는 동적 할당이 2번 발생(변수, 제어 블록 생성)
	- std::make_shared - 동적 바인딩 1회 

```cpp
class A {
	int a,b;
	
	public:
	A(int a, int b) : a(a), b(b) {}
	...
}

std::shared_ptr<A> ptr(new A(3,5));
auto ptr = std::make_share<A>(3,5)
```

___

```cpp
std::shared_ptr<A> p1(new A());
std::shared_ptr<A> p2(p1);  // p2 역시 생성된 객체 A 를 가리킨다.

std::cout << p1.use_count();  // 2
std::cout << p2.use_count();  // 2
```

## shared_ptr 주의점

- std::shared_ptr 인자는 **shared_ptr로 받아야** **제어 블록이 공유**됨
	- 일반 객체의 주소값을 받는 경우 : **새로운 제어 블록 생성**

![](/assets/images/study_log/cpp/2025-07-01-SmartPointer/shared_ptr_sep.png)
출처 : [https://modoocode.com/252](https://modoocode.com/252)

```cpp
#include <iostream>
#include <memory>

class A {
  int* data;

 public:
  A() {
    data = new int[100];
    std::cout << "자원을 획득함!" << std::endl;
  }

  ~A() {
    std::cout << "소멸자 호출!" << std::endl;
    delete[] data;
  }
};

int main() {
  A* a = new A();

  std::shared_ptr<A> pa1(a);
  std::shared_ptr<A> pa2(a);	// error, 새로운 제어 블록 생성, double free
  std::shared_ptr<A> pa2(pa1);	// ok, pa1는 shared_ptr이므로 제어 블록 공유

  std::cout << pa1.use_count() << std::endl;
  std::cout << pa2.use_count() << std::endl;
}
```

- `std::enable_shared_from_this<class>`
	- **객체 내부**에서 자기 자신을 가리키는 경우 : **this**, 즉 **주소값을 참조**해야 함
	- 이 기능을 가능하게 해주는 객체, 필요한 class에 **상속**
- `shared_from_this()` : `std::enable_shared_from_this<class>`의 메소드
	- **std::shared_ptr<class\>(this);** 기능, 즉 **자기 자신의 shared_ptr**(**return**에 사용)
	- **instance**는 **shared_ptr 객체**여야 작동

```cpp
#include <iostream>
#include <memory>

class A : public std::enable_shared_from_this<A> {
  int *data;

 public:
  A() {
    data = new int[100];
    std::cout << "자원을 획득함!" << std::endl;
  }

  ~A() {
    std::cout << "소멸자 호출!" << std::endl;
    delete[] data;
  }

  std::shared_ptr<A> get_shared_ptr() { return shared_from_this(); }
};

int main() {
  A* pa1 = new A();	// error, std::shared_ptr type이 아님
  std::shared_ptr<A> pa1 = std::make_shared<A>();
  std::shared_ptr<A> pa2 = pa1->get_shared_ptr();

  std::cout << pa1.use_count() << std::endl;
  std::cout << pa2.use_count() << std::endl;
}
```

# weak_pointer
> 서로 다른 2개의 shared_ptr가 서로를 가르키고 있으면(**순환 참조**) 객체의 소멸 불가능하다.
> 이 문제를 해결하기 위해 weak_ptr를 사용한다.

![](/assets/images/study_log/cpp/2025-07-01-SmartPointer/pointing_each.png)
출처 : [https://modoocode.com/252](https://modoocode.com/252)

```cpp
#include <iostream>
#include <memory>

class A {
  int *data;
  std::shared_ptr<A> other;

 public:
  A() {
    data = new int[100];
    std::cout << "자원을 획득함!" << std::endl;
  }

  ~A() {
    std::cout << "소멸자 호출!" << std::endl;
    delete[] data;
  }

  void set_other(std::shared_ptr<A> o) { other = o; }
};

int main() {
  std::shared_ptr<A> pa = std::make_shared<A>();
  std::shared_ptr<A> pb = std::make_shared<A>();

  pa->set_other(pb);
  pb->set_other(pa);
}

>>> 

자원을 획득함!
자원을 획득함!	// 소멸자 호출x
```

- shared_ptr와 다르게 **참조 개수를 늘리지 않음**
	- weak_ptr -> shared_ptr 이지만 반대는 성립하지 않을 때, shared_ptr 객체는 소멸($\because$ ref count == 0)
	- **제어 블록을 생성하지 않으므로** 가르키는 **대상이 shared_ptr**여야 함
	- 또한 shared_ptr로 변환 과정 필요
- `std::weak_ptr<T>::lock`
	- ref count == 0 : return 0

```cpp
#include <iostream>
#include <memory>
#include <string>
#include <vector>

class A {
  std::string s;
  std::weak_ptr<A> other;

 public:
  A(const std::string& s) : s(s) { std::cout << "자원을 획득함!" << std::endl; }

  ~A() { std::cout << "소멸자 호출!" << std::endl; }

  void set_other(std::weak_ptr<A> o) { other = o; }
  void access_other() {
    std::shared_ptr<A> o = other.lock();
    if (o) {
      std::cout << "접근 : " << o->name() << std::endl;
    } else {
      std::cout << "이미 소멸됨 ㅠ" << std::endl;
    }
  }
  std::string name() { return s; }
};

int main() {
  std::vector<std::shared_ptr<A>> vec;
  vec.push_back(std::make_shared<A>("자원 1"));
  vec.push_back(std::make_shared<A>("자원 2"));

  vec[0]->set_other(vec[1]);
  vec[1]->set_other(vec[0]);

  // pa 와 pb 의 ref count 는 그대로다.
  std::cout << "vec[0] ref count : " << vec[0].use_count() << std::endl;
  std::cout << "vec[1] ref count : " << vec[1].use_count() << std::endl;

  // weak_ptr 로 해당 객체 접근하기
  vec[0]->access_other();

  // 벡터 마지막 원소 제거 (vec[1] 소멸)
  vec.pop_back();
  vec[0]->access_other();  // 접근 실패!
}

>>> 

자원을 획득함!
자원을 획득함!
vec[0] ref count : 1
vec[1] ref count : 1
접근 : 자원 2
소멸자 호출!
이미 소멸됨 ㅠ
소멸자 호출!
```